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
const { calculateGrade, gradeRemark } = require('../../utils/grading');

// ── Tiny HTTP helper (no axios dependency) ───────────────────────────────────

/**
 * Makes a GET request to a URL and resolves with the parsed JSON body.
 * Works for both http:// and https://.
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error: ${body.substring(0, 200)}`)); }
      });
    }).on('error', reject);
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
  const base = baseUrl.replace(/\/$/, '');
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

    onLog({ type: 'info', message: `Fetching enrolled users for course ${courseId} (${subjectCode})...` });

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

    onLog({ type: 'info', message: `Found ${enrolled.length} enrolled users in course ${courseId}` });

    // Step 2: For each enrolled user, fetch their grade items
    for (const moodleUser of enrolled) {
      const rawId  = String(moodleUser[idField] || '').trim().toLowerCase();
      if (!rawId) { skipped++; continue; }

      // Match to SMS student
      const smsStudent = studentByAdmNo.get(rawId) || studentByMoodle.get(rawId);
      if (!smsStudent) {
        onLog({ type: 'warn', message: `No SMS student found for Moodle identifier "${rawId}" — skipped` });
        skipped++;
        continue;
      }

      // Fetch grade items for this user in this course
      let gradeData;
      try {
        gradeData = await moodleCall(
          moodleUrl, moodleToken,
          'gradereport_user_get_grade_items',
          { courseid: courseId, userid: moodleUser.id }
        );
      } catch (e) {
        onLog({ type: 'warn', message: `Could not fetch grades for user ${rawId} in course ${courseId}: ${e.message}` });
        skipped++;
        continue;
      }

      // Parse grade items — Moodle returns: { usergrades: [{ gradeitems: [...] }] }
      const gradeItems = gradeData?.usergrades?.[0]?.gradeitems || [];

      let ca   = null;
      let exam = null;

      for (const item of gradeItems) {
        const itemName = (item.itemname || '').toUpperCase();
        const grade    = parseFloat(item.graderaw) || 0;

        if (itemName.includes(caGradeItemName.toUpperCase()))   ca   = grade;
        if (itemName.includes(examGradeItemName.toUpperCase())) exam = grade;

        // Also catch "Course total" as a fallback if no explicit split exists
        if (ca === null && exam === null && item.itemtype === 'course') {
          // Treat the full course total as exam score, CA = 0
          exam = grade;
        }
      }

      ca   = ca   ?? 0;
      exam = exam ?? 0;

      // Store in collection
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
      const { subjectId, ca, exam } = gradeEntry;

      let total      = ca + exam;
      let finalTotal = total;
      let remarkText = gradeRemark(calculateGrade(total));

      // Third-term cumulative average (matches your existing uploadSuperadminExcel logic)
      if (term === 'THIRD') {
        const [t1Result, t2Result] = await Promise.all([
          prisma.result.findUnique({
            where: { result_unique: { studentId, subjectId, session, term: 'FIRST' } },
            select: { total: true },
          }),
          prisma.result.findUnique({
            where: { result_unique: { studentId, subjectId, session, term: 'SECOND' } },
            select: { total: true },
          }),
        ]);
        const t1 = t1Result?.total ?? 0;
        const t2 = t2Result?.total ?? 0;
        finalTotal = (t1 + t2 + total) / 3;
        remarkText = `Cumulative Avg: ${finalTotal.toFixed(1)} (${gradeRemark(calculateGrade(finalTotal))})`;
      }

      const grade = calculateGrade(finalTotal);

      ops.push(
        prisma.result.upsert({
          where:  { result_unique: { studentId, subjectId, session, term } },
          update: { caScore: ca, examScore: exam, total: finalTotal, grade, remark: remarkText },
          create: { studentId, subjectId, session, term, caScore: ca, examScore: exam, total: finalTotal, grade, remark: remarkText },
        })
      );
    }
  }

  if (ops.length) {
    // Batch in chunks of 50 to avoid transaction timeouts on large schools
    const CHUNK = 50;
    for (let i = 0; i < ops.length; i += CHUNK) {
      await prisma.$transaction(ops.slice(i, i + CHUNK));
    }
  }

  const saved = ops.length;
  onLog({ type: 'success', message: `✅ Sync complete. Saved ${saved} result(s). Skipped ${skipped}. Errors: ${errors.length}` });

  return { total: totalFetched, saved, skipped, errors };
}

module.exports = { runSync };
