/**
 * moodle.engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Core sync engine: pulls grade data from Moodle REST API and writes results
 * directly into the SMS PostgreSQL database via Prisma.
 *
 * Moodle API calls used:
 *  1. core_enrol_get_enrolled_users     → get users (with their usernames) per course
 *  2. gradereport_user_get_grade_items  → get grade items for a user in a course
 */

const https  = require('https');
const http   = require('http');
const prisma = require('../../config/db');
const { calculateGrade, gradeRemark, calculatePositions } = require('../../utils/grading');

// ── Tiny HTTP helper (no axios dependency) ───────────────────────────────────

/**
 * Makes a GET request to a URL and resolves with the parsed JSON body.
 * Works for both http:// and https://.
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Moodle returned non-JSON response (HTTP ${res.statusCode}): ${body.substring(0, 150)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Moodle API request timed out after 15 seconds'));
    });
  });
}

/**
 * Calls a Moodle Web Service function.
 * @param {string} baseUrl    - e.g. "https://moodle.example.com"
 * @param {string} token      - Moodle web service token
 * @param {string} wsfunction - e.g. "core_enrol_get_enrolled_users"
 * @param {Object} params     - additional query params
 */
async function moodleCall(baseUrl, token, wsfunction, params = {}) {
  let base = (baseUrl || '').trim().replace(/\/$/, '');
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `http://${base}`;
  }
  const qs   = new URLSearchParams({
    wstoken:            token,
    moodlewsrestformat: 'json',
    wsfunction,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const url = `${base}/webservice/rest/server.php?${qs.toString()}`;
  const data = await httpGet(url);

  // Moodle returns { exception, message } on errors
  if (data && data.exception) {
    throw new Error(`Moodle API error [${wsfunction}]: ${data.message}`);
  }
  return data;
}

// ── Term normalizer ──────────────────────────────────────────────────────────

const VALID_TERMS = ['FIRST', 'SECOND', 'THIRD'];

function normalizeTerm(raw) {
  if (!raw) return 'FIRST';
  const s = String(raw).trim().toUpperCase();
  if (s === 'FIRST'  || s === 'FIRST TERM'  || s === '1' || s === '1ST') return 'FIRST';
  if (s === 'SECOND' || s === 'SECOND TERM' || s === '2' || s === '2ND') return 'SECOND';
  if (s === 'THIRD'  || s === 'THIRD TERM'  || s === '3' || s === '3RD') return 'THIRD';
  if (VALID_TERMS.includes(s)) return s;
  throw new Error(`Invalid term: "${raw}"`);
}

// ── Main sync function ───────────────────────────────────────────────────────

/**
 * Fetches grades from Moodle for every configured course and upserts Results
 * in the SMS database.
 *
 * @param {Object} config   - from getMoodleConfig()
 * @param {string} session  - e.g. "2025/2026"
 * @param {string} termRaw  - e.g. "FIRST"
 * @param {Function} onLog  - callback(logEntry) for streaming progress
 * @returns {{ total: number, skipped: number, errors: string[] }}
 */
async function runSync(config, session, termRaw, onLog = () => {}) {
  const { moodleUrl, moodleToken, idField = 'username', courseMap = [] } = config;
  const term = normalizeTerm(termRaw);

  if (!moodleUrl || !moodleToken) throw new Error('Moodle URL and token are required in config');
  if (!courseMap.length)          throw new Error('No course mappings configured');

  // ── Load all SMS students & subjects once ────────────────────────────────
  onLog({ type: 'info', message: 'Loading SMS students and subjects...' });

  const [smsStudents, smsSubjects] = await Promise.all([
    prisma.student.findMany({
      select: { id: true, admissionNo: true, moodleUsername: true },
    }),
    prisma.subject.findMany({ select: { id: true, code: true } }),
  ]);

  // Build lookup maps (all lowercased for case-insensitive matching)
  const studentByAdmNo   = new Map(smsStudents.map(s => [s.admissionNo?.toLowerCase(),   s]));
  const studentByMoodle  = new Map(smsStudents.map(s => [s.moodleUsername?.toLowerCase(), s]));
  const subjectByCode    = new Map(smsSubjects.map(s => [s.code.toUpperCase(), s]));

  onLog({ type: 'info', message: `Loaded ${smsStudents.length} students, ${smsSubjects.length} subjects` });

  // ── Collect grades per student across all courses ────────────────────────
  // Pre-load all existing results for this session & term to preserve scores in memory
  const existingResults = await prisma.result.findMany({
    where: { session, term },
    select: { studentId: true, subjectId: true, caScore: true, examScore: true },
  });
  const existingMap = new Map(existingResults.map(r => [`${r.studentId}_${r.subjectId}`, r]));

  // Structure: { admissionNo → { subjectCode → { ca, exam } } }
  const gradesByStudent = new Map();

  let totalFetched = 0;
  let skipped      = 0;
  const errors     = [];

  for (const mapping of courseMap) {
    const { courseId, subjectCode, caGradeItemName = 'CA', examGradeItemName = 'EXAM' } = mapping;
    const subjectCodeUC = subjectCode.toUpperCase();
    const smsSubject    = subjectByCode.get(subjectCodeUC);

    if (!smsSubject) {
      const msg = `Subject code "${subjectCode}" not found in SMS — skipping course ${courseId}`;
      onLog({ type: 'warn', message: msg });
      errors.push(msg);
      continue;
    }

    onLog({ type: 'info', message: `Syncing course ${courseId} (${subjectCode})...` });

    // Step 1: Get enrolled users for this course
    let enrolled;
    try {
      enrolled = await moodleCall(moodleUrl, moodleToken, 'core_enrol_get_enrolled_users', { courseid: courseId });
    } catch (e) {
      const msg = `Failed to fetch enrolled users for course ${courseId}: ${e.message}`;
      onLog({ type: 'error', message: msg });
      errors.push(msg);
      continue;
    }

    if (!Array.isArray(enrolled) || !enrolled.length) {
      onLog({ type: 'warn', message: `No enrolled users found for course ${courseId}` });
      continue;
    }

    const moodleUserMap = new Map(enrolled.map(u => [u.id, u]));

    // Step 2: Fetch ALL grades for the entire course in 1 single bulk API call!
    let gradeReport;
    try {
      gradeReport = await moodleCall(moodleUrl, moodleToken, 'gradereport_user_get_grade_items', { courseid: courseId });
    } catch (e) {
      const msg = `Could not fetch grades for course ${courseId}: ${e.message}`;
      onLog({ type: 'warn', message: msg });
      errors.push(msg);
      continue;
    }

    const usergrades = gradeReport?.usergrades || [];
    onLog({ type: 'info', message: `Found grades for ${usergrades.length} students in course ${courseId}` });

    for (const ug of usergrades) {
      const moodleUser = moodleUserMap.get(ug.userid);
      if (!moodleUser) continue;

      const rawId = String(moodleUser[idField] || '').trim().toLowerCase();
      if (!rawId) { skipped++; continue; }

      const smsStudent = studentByAdmNo.get(rawId) || studentByMoodle.get(rawId);
      if (!smsStudent) {
        skipped++;
        continue;
      }

      const gradeItems = ug.gradeitems || [];
      let ca   = null;
      let exam = null;

      for (const item of gradeItems) {
        const itemName = (item.itemname || '').toUpperCase();
        if (caGradeItemName && itemName.includes(caGradeItemName.toUpperCase())) {
          ca = (item.graderaw !== null && item.graderaw !== undefined) ? parseFloat(item.graderaw) : 0;
        }
        if (examGradeItemName && itemName.includes(examGradeItemName.toUpperCase())) {
          exam = (item.graderaw !== null && item.graderaw !== undefined) ? parseFloat(item.graderaw) : 0;
        }
      }

      // If no explicit CA item was found by name, pick the quiz module or course total
      if (ca === null) {
        const modItem    = gradeItems.find(i => i.itemtype === 'mod');
        const courseItem = gradeItems.find(i => i.itemtype === 'course');
        if (modItem && modItem.graderaw !== null && modItem.graderaw !== undefined) {
          ca = parseFloat(modItem.graderaw) || 0;
        } else if (courseItem && courseItem.graderaw !== null && courseItem.graderaw !== undefined) {
          ca = parseFloat(courseItem.graderaw) || 0;
        }
      }

      if (!gradesByStudent.has(smsStudent.id)) {
        gradesByStudent.set(smsStudent.id, { smsStudent, subjects: new Map() });
      }
      gradesByStudent.get(smsStudent.id).subjects.set(smsSubject.id, {
        subjectId: smsSubject.id,
        subjectCode: subjectCodeUC,
        ca,
        exam,
      });

      totalFetched++;
    }
  }

  onLog({ type: 'info', message: `Grade data collected for ${gradesByStudent.size} students. Writing to database...` });

  // ── Upsert all results into database ─────────────────────────────────────
  const ops = [];

  for (const [studentId, { smsStudent, subjects }] of gradesByStudent) {
    for (const [, gradeEntry] of subjects) {
      const { subjectId, ca: rawCa, exam: rawExam } = gradeEntry;

      const existing = existingMap.get(`${studentId}_${subjectId}`);
      const ca   = (rawCa !== null)   ? rawCa   : (existing?.caScore ?? 0);
      const exam = (rawExam !== null) ? rawExam : (existing?.examScore ?? 0);

      let total      = ca + exam;
      let finalTotal = total;
      let remarkText = gradeRemark(calculateGrade(total));

      const grade = calculateGrade(finalTotal);

      // Store as a lazy function, NOT an eagerly executed promise
      ops.push(() =>
        prisma.result.upsert({
          where:  { result_unique: { studentId, subjectId, session, term } },
          update: { caScore: ca, examScore: exam, total: finalTotal, grade, remark: remarkText },
          create: { studentId, subjectId, session, term, caScore: ca, examScore: exam, total: finalTotal, grade, remark: remarkText },
        })
      );
    }
  }

  onLog({ type: 'info', message: `Writing ${ops.length} results to database...` });

  // Execute in batches of 20 to speed up execution while respecting Supabase connection pool
  const BATCH_SIZE = 20;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = ops.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fn => fn()));
  }

  // Recalculate student positions in database for this session and term
  try {
    onLog({ type: 'info', message: 'Recalculating student subject positions across classes...' });
    const classes = await prisma.class.findMany({ select: { id: true } });
    const subjects = await prisma.subject.findMany({ select: { id: true } });

    for (const c of classes) {
      const classStudents = await prisma.student.findMany({
        where: { currentClassId: c.id },
        select: { id: true },
      });
      if (!classStudents.length) continue;
      const classStudentIds = classStudents.map(s => s.id);

      for (const sub of subjects) {
        const subResults = await prisma.result.findMany({
          where: { studentId: { in: classStudentIds }, subjectId: sub.id, session, term },
          select: { id: true, studentId: true, total: true },
        });
        if (!subResults.length) continue;

        const posMap = calculatePositions(subResults);
        for (const [sid, pos] of Object.entries(posMap)) {
          await prisma.result.updateMany({
            where: { studentId: sid, subjectId: sub.id, session, term },
            data: { position: pos },
          });
        }
      }
    }
  } catch (posErr) {
    onLog({ type: 'warn', message: `Position calculation notice: ${posErr.message}` });
  }

  const saved = ops.length;
  onLog({ type: 'success', message: `✅ Sync complete. Saved ${saved} result(s). Skipped ${skipped}. Errors: ${errors.length}` });

  return { total: totalFetched, saved, skipped, errors };
}

module.exports = { runSync };
