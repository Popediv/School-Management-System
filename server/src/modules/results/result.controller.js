const prisma = require('../../config/db');
const { calculateGrade, gradeRemark, calculatePositions, formatPosition } = require('../../utils/grading');
const { getStoredSettings } = require('../settings/settings.controller');
const { readPsychomotor, writePsychomotor, getStudentPsychomotor } = require('./psychomotor.store');
const xlsx = require('xlsx');

// ── Term normalizer ───────────────────────────────────────────────────────────
// Accepts any reasonable format and returns the Prisma enum value
const normalizeTerm = (raw) => {
  if (!raw) return 'FIRST';
  const s = String(raw).trim().toUpperCase();
  if (s === 'FIRST' || s === 'FIRST TERM' || s === '1' || s === '1ST') return 'FIRST';
  if (s === 'second' || s === 'SECOND TERM' || s === '2' || s === '2ND') return 'SECOND';
  if (s === 'third' || s === 'THIRD TERM' || s === '3' || s === '3RD') return 'THIRD';
  // already uppercase enum value
  if (['FIRST', 'SECOND', 'THIRD'].includes(s)) return s;
  throw new Error(`Invalid term value: "${raw}". Expected FIRST, SECOND, or THIRD.`);
};

// POST /api/results — upload/update scores (supports single OR bulk { records: [] })
const upload = async (req, res, next) => {
  try {
    // ── Bulk mode ─────────────────────────────────────────────────────────────
    if (Array.isArray(req.body.records)) {
      const { records } = req.body;
      if (!records.length)
        return res.status(400).json({ message: 'No records provided' });

      const now = new Date();
      const yr = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const defaultSession = `${yr}/${yr + 1}`;

      const ops = records.map(r => {
        const studentId = r.studentId;
        const subjectId = r.subjectId;
        const term = normalizeTerm(r.term);
        const session = r.session || defaultSession;
        const ca = parseFloat(r.ca ?? r.caScore ?? 0);
        const exam = parseFloat(r.exam ?? r.examScore ?? 0);
        const total = Math.round(ca + exam);
        const grade = calculateGrade(total);
        const remark = gradeRemark(grade);

        return prisma.result.upsert({
          where: { result_unique: { studentId, subjectId, session, term } },
          update: { caScore: ca, examScore: exam, total, grade, remark },
          create: { studentId, subjectId, session, term, caScore: ca, examScore: exam, total, grade, remark },
        });
      });

      const results = await prisma.$transaction(ops);

      // Auto-calculate positions for this class + subject if classId provided
      try {
        const classId = records[0]?.classId;
        const subjectId = records[0]?.subjectId;
        const session = records[0]?.session || defaultSession;
        const term = normalizeTerm(records[0]?.term);
        if (classId && subjectId) {
          const cStudents = await prisma.student.findMany({
            where: { currentClassId: classId },
            select: { id: true },
          });
          const cIds = cStudents.map(s => s.id);
          const subResults = await prisma.result.findMany({
            where: { studentId: { in: cIds }, subjectId, session, term },
            select: { id: true, studentId: true, total: true },
          });
          const posMap = calculatePositions(subResults);
          const posOps = Object.entries(posMap).map(([sid, pos]) =>
            prisma.result.updateMany({
              where: { studentId: sid, subjectId, session, term },
              data: { position: pos },
            })
          );
          if (posOps.length > 0) {
            await prisma.$transaction(posOps);
          }
        }
      } catch (calcErr) {
        // Log without blocking response
        console.error('Auto position calculation error:', calcErr?.message);
      }

      return res.status(201).json({ message: `${results.length} result(s) saved`, results });
    }

    // ── Single mode ───────────────────────────────────────────────────────────
    const { studentId, subjectId, session, caScore, examScore } = req.body;
    const term = normalizeTerm(req.body.term);

    if (!studentId || !subjectId || !session || !term)
      return res.status(400).json({ message: 'studentId, subjectId, session, term are required' });

    const ca = parseFloat(caScore) || 0;
    const exam = parseFloat(examScore) || 0;
    const total = Math.round(ca + exam);
    const grade = calculateGrade(total);
    const remark = gradeRemark(grade);

    const result = await prisma.result.upsert({
      where: { result_unique: { studentId, subjectId, session, term } },
      update: { caScore: ca, examScore: exam, total, grade, remark },
      create: { studentId, subjectId, session, term, caScore: ca, examScore: exam, total, grade, remark },
    });

    res.status(201).json({ message: 'Result saved', result });
  } catch (err) { next(err); }
};

// GET /api/results/student/:studentId?session=&term=
const getByStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { session } = req.query;
    const term = req.query.term ? normalizeTerm(req.query.term) : undefined;

    const where = {
      studentId,
      ...(session && { session }),
      ...(term && { term }),
    };

    const results = await prisma.result.findMany({
      where,
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });

    res.json({ results });
  } catch (err) { next(err); }
};

// GET /api/results/class-scores?classId=&subjectId=&session=&term=
const getClassScores = async (req, res, next) => {
  try {
    const { classId, subjectId, session } = req.query;
    const term = req.query.term ? normalizeTerm(req.query.term) : undefined;

    if (!classId) {
      return res.status(400).json({ message: 'classId is required' });
    }

    const students = await prisma.student.findMany({
      where: { currentClassId: classId, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        photo: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    let results = [];
    if (subjectId && students.length > 0) {
      const studentIds = students.map(s => s.id);
      results = await prisma.result.findMany({
        where: {
          studentId: { in: studentIds },
          subjectId,
          ...(session && { session }),
          ...(term && { term }),
        },
      });
    }

    const resultsMap = {};
    results.forEach(r => {
      resultsMap[r.studentId] = {
        id: r.id,
        caScore: r.caScore,
        examScore: r.examScore,
        total: r.total,
        grade: r.grade,
        remark: r.remark,
        position: r.position ? formatPosition(r.position) : null,
        published: r.published,
      };
    });

    res.json({ students, resultsMap });
  } catch (err) { next(err); }
};

// Helper: build a single student's complete report card
const buildStudentReportCard = async (studentId, session, term, userRole) => {
  const [student, results, attendances] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: {
        currentClass: true,
        parent: { select: { name: true } },
      },
    }),

    prisma.result.findMany({
      where: {
        studentId,
        ...(session && { session }),
        ...(term && { term }),
      },
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    }),

    // Attendance for this student
    prisma.attendance.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { studentId },
    }),
  ]);

  if (!student) return null;

  const storedSettings = getStoredSettings();
  const isResultsReleased = Boolean(storedSettings?.resultsReleased);

  // If student is viewing report card and results are withheld:
  if (userRole === 'STUDENT' && !isResultsReleased) {
    const err = new Error('Official report cards for this term have not yet been released by the school administration.');
    err.status = 403;
    throw err;
  }

  const attPresent = attendances.find(a => a.status === 'PRESENT')?._count.status || 0;
  const attAbsent = attendances.find(a => a.status === 'ABSENT')?._count.status || 0;
  const attLate = attendances.find(a => a.status === 'LATE')?._count.status || 0;
  const attTotal = attPresent + attAbsent + attLate;
  const attRate = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;
  // Attendance Score (value from attendance page - out of 10)
  const attScore = attTotal ? Math.round((attPresent / attTotal) * 10 * 10) / 10 : 0;

  // Load classmate results to compute real positions if not set
  let classResults = [];
  let classmateIds = [];
  let classmateAttMap = {};
  if (student.currentClassId && results.length > 0) {
    const classmates = await prisma.student.findMany({
      where: { currentClassId: student.currentClassId },
      select: { id: true },
    });
    classmateIds = classmates.map(c => c.id);
    const subjectIds = results.map(r => r.subjectId);
    classResults = await prisma.result.findMany({
      where: {
        studentId: { in: classmateIds },
        subjectId: { in: subjectIds },
        ...(session && { session }),
        ...(term && { term }),
      },
      select: { studentId: true, subjectId: true, total: true, caScore: true, examScore: true },
    });
    // Also fetch classmate attendance for accurate processed-total ranking
    const classmateAttRaw = await prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      _count: { status: true },
      where: { studentId: { in: classmateIds } },
    });
    for (const row of classmateAttRaw) {
      if (!classmateAttMap[row.studentId]) classmateAttMap[row.studentId] = { PRESENT: 0, ABSENT: 0, LATE: 0 };
      classmateAttMap[row.studentId][row.status] = (classmateAttMap[row.studentId][row.status] || 0) + row._count.status;
    }
  }

  // Process results: CA capped at 30, Exam at 70, Total strictly a whole number
  const processedResults = results.map(r => {
    const combinedCA = Math.min(30, Math.round(((r.caScore || 0) + attScore) * 10) / 10);
    const total = Math.round(combinedCA + (r.examScore || 0));
    const grade = calculateGrade(total);
    const remark = gradeRemark(grade);

    let pos = r.position;
    if (!pos && classResults.length > 0) {
      const subRes = classResults.filter(cr => cr.subjectId === r.subjectId);
      const ranks = calculatePositions(subRes);
      pos = ranks[student.id] || null;
    }

    return {
      ...r,
      rawCaScore: r.caScore,
      attendanceScore: attScore,
      caScore: combinedCA,
      total,
      grade,
      remark,
      position: pos ? formatPosition(pos) : '—',
    };
  });

  const totalScore = Math.round(processedResults.reduce((s, r) => s + r.total, 0));
  const average = processedResults.length
    ? (totalScore / processedResults.length).toFixed(1)
    : 0;

  // Overall class position — rank by average of processed totals (matches displayed average)
  let overallPosDisplay = '—';
  if (student.currentClassId && classResults.length > 0) {
    const processedSum = {};
    const subjectCount = {};
    classmateIds.forEach(id => { processedSum[id] = 0; subjectCount[id] = 0; });
    classResults.forEach(cr => {
      if (processedSum[cr.studentId] === undefined) return;
      const cAtt = classmateAttMap[cr.studentId] || { PRESENT: 0, ABSENT: 0, LATE: 0 };
      const totAtt = cAtt.PRESENT + cAtt.ABSENT + cAtt.LATE;
      const cAttScore = totAtt ? Math.round((cAtt.PRESENT / totAtt) * 10 * 10) / 10 : 0;
      const combinedCA = Math.min(30, Math.round(((cr.caScore || 0) + cAttScore) * 10) / 10);
      const pTotal = Math.round(combinedCA + (cr.examScore || 0));
      processedSum[cr.studentId] += pTotal;
      subjectCount[cr.studentId]++;
    });
    const overallRankings = Object.entries(processedSum).map(([sid, sum]) => ({
      studentId: sid,
      total: parseFloat((sum / (subjectCount[sid] || 1)).toFixed(2)),
    }));
    const overallPositions = calculatePositions(overallRankings);
    const myRank = overallPositions[student.id];
    if (myRank) {
      overallPosDisplay = `${formatPosition(myRank)} of ${classmateIds.length}`;
    }
  }

  const studentPsychomotor = getStudentPsychomotor(studentId, session, term || 'FIRST');
  const photoUrl = student.photo
    ? (student.photo.startsWith('http') || student.photo.startsWith('data:')
        ? student.photo
        : (student.photo.startsWith('/uploads/')
            ? student.photo
            : (student.photo.startsWith('/') ? student.photo : `/uploads/${student.photo}`)))
    : null;

  return {
    student: {
      ...student,
      photoUrl,
      photo: photoUrl || student.photo,
      attendance: {
        present: attPresent,
        absent: attAbsent,
        late: attLate,
        rate: attRate,
        score: attScore,
        maxScore: 10,
        display: `${attScore}/10`,
      },
    },
    results: processedResults,
    summary: {
      totalScore,
      average,
      subjectCount: processedResults.length,
      position: overallPosDisplay,
    },
    psychomotor: studentPsychomotor,
  };
};

// GET /api/results/report-card/:studentId?session=&term=
const getReportCard = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { session } = req.query;
    const term = req.query.term ? normalizeTerm(req.query.term) : undefined;

    const reportCard = await buildStudentReportCard(studentId, session, term, req.user?.role);
    if (!reportCard) return res.status(404).json({ message: 'Student not found' });

    res.json(reportCard);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, resultsReleased: false });
    next(err);
  }
};

// GET /api/results/bulk-report-cards?classId=&studentIds=&session=&term=
// High-performance bulk report card compiler (3 queries in parallel vs 120 serial queries)
const getBulkReportCards = async (req, res, next) => {
  try {
    const { classId, session } = req.query;
    const studentIdsParam = req.query.studentIds;
    const term = req.query.term ? normalizeTerm(req.query.term) : undefined;

    let targetStudentIds = [];
    if (studentIdsParam) {
      targetStudentIds = studentIdsParam.split(',').map(s => s.trim()).filter(Boolean);
    }

    let targetClassId = classId;
    if (!targetClassId && targetStudentIds.length > 0) {
      const firstStudent = await prisma.student.findUnique({
        where: { id: targetStudentIds[0] },
        select: { currentClassId: true },
      });
      targetClassId = firstStudent?.currentClassId;
    }

    // 1. Fetch all students in the class (needed for accurate class rankings & sizes)
    const allStudentsInClass = await prisma.student.findMany({
      where: targetClassId
        ? { currentClassId: targetClassId }
        : { id: { in: targetStudentIds } },
      include: {
        currentClass: true,
        parent: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    if (allStudentsInClass.length === 0) {
      return res.json({ reportCards: [], count: 0 });
    }

    const classStudentIds = allStudentsInClass.map(s => s.id);
    const classSize = classStudentIds.length;

    // 2. Fetch all results and attendances for the entire class in ONE parallel batch
    const [allResults, allAttendances] = await Promise.all([
      prisma.result.findMany({
        where: {
          studentId: { in: classStudentIds },
          ...(session && { session }),
          ...(term && { term }),
        },
        include: { subject: { select: { name: true, code: true } } },
        orderBy: { subject: { name: 'asc' } },
      }),

      prisma.attendance.groupBy({
        by: ['studentId', 'status'],
        _count: { status: true },
        where: { studentId: { in: classStudentIds } },
      }),
    ]);

    // 3. Read psychomotor data once from disk
    const allPsychomotors = readPsychomotor();

    // 4. Index attendances by studentId
    const attendancesByStudent = new Map();
    for (const a of allAttendances) {
      if (!attendancesByStudent.has(a.studentId)) {
        attendancesByStudent.set(a.studentId, { PRESENT: 0, ABSENT: 0, LATE: 0 });
      }
      attendancesByStudent.get(a.studentId)[a.status] = a._count.status;
    }

    // 5. Index results by studentId and by subjectId
    const resultsByStudent = new Map();
    const resultsBySubject = new Map();

    for (const r of allResults) {
      if (!resultsByStudent.has(r.studentId)) resultsByStudent.set(r.studentId, []);
      resultsByStudent.get(r.studentId).push(r);

      if (!resultsBySubject.has(r.subjectId)) resultsBySubject.set(r.subjectId, []);
      resultsBySubject.get(r.subjectId).push(r);
    }

    // 6. Precompute subject ranks and averages in memory
    const subjectRanksMap = new Map();
    const subjectAvgMap = new Map();

    for (const [subId, subResults] of resultsBySubject) {
      subjectRanksMap.set(subId, calculatePositions(subResults));
      const scored = subResults.filter(r => typeof r.total === 'number');
      const avg = scored.length
        ? Math.round(scored.reduce((s, r) => s + Math.round(r.total), 0) / scored.length)
        : null;
      subjectAvgMap.set(subId, avg);
    }

    // 7. Rank by AVERAGE of processed totals (CA+attScore capped at 30 + examScore)
    //    This matches exactly the "average" shown on the report card.
    const studentProcessedSum = {};
    const studentSubjectCount = {};
    for (const s of allStudentsInClass) {
      studentProcessedSum[s.id] = 0;
      studentSubjectCount[s.id] = 0;
    }
    for (const r of allResults) {
      if (studentProcessedSum[r.studentId] !== undefined) {
        const att = attendancesByStudent.get(r.studentId) || { PRESENT: 0, ABSENT: 0, LATE: 0 };
        const totAtt = att.PRESENT + att.ABSENT + att.LATE;
        const attScore = totAtt ? Math.round((att.PRESENT / totAtt) * 10 * 10) / 10 : 0;
        const combinedCA = Math.min(30, Math.round(((r.caScore || 0) + attScore) * 10) / 10);
        const processedTotal = Math.round(combinedCA + (r.examScore || 0));
        studentProcessedSum[r.studentId] += processedTotal;
        studentSubjectCount[r.studentId]++;
      }
    }
    // Pass average as `total` so calculatePositions ranks highest average first
    const overallRankings = Object.entries(studentProcessedSum).map(([sid, sum]) => {
      const count = studentSubjectCount[sid] || 1;
      return { studentId: sid, total: parseFloat((sum / count).toFixed(2)) };
    });
    const overallPositions = calculatePositions(overallRankings);

    // 8. Filter students to return (all students or targeted selection)
    const targetSet = targetStudentIds.length > 0 ? new Set(targetStudentIds) : null;
    const studentsToBuild = targetSet
      ? allStudentsInClass.filter(s => targetSet.has(s.id))
      : allStudentsInClass;

    // 9. Build report cards in memory with strictly whole numbers
    const reportCards = studentsToBuild.map((student) => {
      const att = attendancesByStudent.get(student.id) || { PRESENT: 0, ABSENT: 0, LATE: 0 };
      const attPresent = att.PRESENT;
      const attAbsent = att.ABSENT;
      const attLate = att.LATE;
      const attTotal = attPresent + attAbsent + attLate;
      const attRate = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;
      const attScore = attTotal ? Math.round((attPresent / attTotal) * 10 * 10) / 10 : 0;

      const rawResults = resultsByStudent.get(student.id) || [];
      const processedResults = rawResults.map((r) => {
        const combinedCA = Math.min(30, Math.round(((r.caScore || 0) + attScore) * 10) / 10);
        const total = Math.round(combinedCA + (r.examScore || 0));
        const grade = calculateGrade(total);
        const remark = gradeRemark(grade);

        let pos = r.position;
        if (!pos && subjectRanksMap.has(r.subjectId)) {
          pos = subjectRanksMap.get(r.subjectId)[student.id] || null;
        }

        return {
          ...r,
          rawCaScore: r.caScore,
          attendanceScore: attScore,
          caScore: combinedCA,
          total,
          grade,
          remark,
          position: pos ? formatPosition(pos) : '—',
          classAverage: subjectAvgMap.get(r.subjectId) ?? null,
        };
      });

      const totalScore = Math.round(processedResults.reduce((s, r) => s + r.total, 0));
      const average = processedResults.length
        ? (totalScore / processedResults.length).toFixed(1)
        : 0;

      const myRank = overallPositions[student.id];
      const overallPosDisplay = myRank ? `${formatPosition(myRank)} of ${classSize}` : '—';

      const psychKey = `${student.id}_${session}_${term || 'FIRST'}`;
      const studentPsychomotor = allPsychomotors[psychKey]?.traits || null;

      const photoUrl = student.photo
        ? (student.photo.startsWith('http') || student.photo.startsWith('data:')
            ? student.photo
            : (student.photo.startsWith('/uploads/')
                ? student.photo
                : (student.photo.startsWith('/') ? student.photo : `/uploads/${student.photo}`)))
        : null;

      return {
        student: {
          ...student,
          photoUrl,
          photo: photoUrl || student.photo,
          attendance: {
            present: attPresent,
            absent: attAbsent,
            late: attLate,
            rate: attRate,
            score: attScore,
            maxScore: 10,
            display: `${attScore}/10`,
          },
        },
        results: processedResults,
        summary: {
          totalScore,
          average,
          subjectCount: processedResults.length,
          position: overallPosDisplay,
          classSize,
        },
        psychomotor: studentPsychomotor,
      };
    });

    res.json({ reportCards, count: reportCards.length });
  } catch (err) { next(err); }
};


// POST /api/results/calculate — bulk position calculation for a class + subject
const calculate = async (req, res, next) => {
  try {
    const { classId, subjectId, session } = req.body;
    const term = normalizeTerm(req.body.term);

    const students = await prisma.student.findMany({
      where: { currentClassId: classId },
      select: { id: true },
    });
    const studentIds = students.map(s => s.id);

    const results = await prisma.result.findMany({
      where: { studentId: { in: studentIds }, subjectId, session, term },
      select: { id: true, studentId: true, total: true },
    });

    const positions = calculatePositions(results);

    const updates = Object.entries(positions).map(([sid, pos]) =>
      prisma.result.updateMany({
        where: { studentId: sid, subjectId, session, term },
        data: { position: pos },
      })
    );

    await prisma.$transaction(updates);
    res.json({ message: 'Positions calculated', positions });
  } catch (err) { next(err); }
};

// PATCH /api/results/:id/publish
const publish = async (req, res, next) => {
  try {
    await prisma.result.update({
      where: { id: req.params.id },
      data: { published: true },
    });
    res.json({ message: 'Result published' });
  } catch (err) { next(err); }
};

// POST /api/results/upload-teacher-excel
const uploadTeacherExcel = async (req, res, next) => {
  try {
    const { classId, subjectId, session } = req.body;
    const term = normalizeTerm(req.body.term);

    if (!classId || !subjectId || !session || !term || !req.file) {
      return res.status(400).json({ message: 'Missing required fields or file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const students = await prisma.student.findMany({
      where: { currentClassId: classId },
      select: { id: true, admissionNo: true, moodleUsername: true, firstName: true, lastName: true },
    });

    let successCount = 0;
    const ops = [];

    for (const row of data) {
      // Find matching student
      const identifier = row['Admission No'] || row['Admission Number'] || row['Username'] || row['Moodle Username'];
      if (!identifier) continue;

      const student = students.find(s =>
        (s.admissionNo && s.admissionNo.toLowerCase() === String(identifier).toLowerCase()) ||
        (s.moodleUsername && s.moodleUsername.toLowerCase() === String(identifier).toLowerCase())
      );
      if (!student) continue;

      const ca = parseFloat(row['CA'] ?? row['CA Score'] ?? 0) || 0;
      const exam = parseFloat(row['Exam'] ?? row['Exam Score'] ?? 0) || 0;
      const total = Math.round(ca + exam);
      const grade = calculateGrade(total);
      const remark = gradeRemark(grade);

      ops.push(prisma.result.upsert({
        where: { result_unique: { studentId: student.id, subjectId, session, term } },
        update: { caScore: ca, examScore: exam, total, grade, remark },
        create: { studentId: student.id, subjectId, session, term, caScore: ca, examScore: exam, total, grade, remark },
      }));
      successCount++;
    }

    await prisma.$transaction(ops);
    res.json({ message: `Successfully uploaded and processed ${successCount} records.`, count: successCount });
  } catch (err) { next(err); }
};

// POST /api/results/upload-superadmin-excel
const uploadSuperadminExcel = async (req, res, next) => {
  try {
    const { session } = req.body;
    const term = normalizeTerm(req.body.term);

    if (!session || !term || !req.file) {
      return res.status(400).json({ message: 'Missing required fields or file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const students = await prisma.student.findMany({
      select: { id: true, admissionNo: true, moodleUsername: true },
    });
    const subjects = await prisma.subject.findMany({ select: { id: true, code: true } });

    let successCount = 0;
    const ops = [];

    for (const row of data) {
      const identifier = row['Admission No'] || row['Admission Number'] || row['Username'] || row['Moodle Username'];
      if (!identifier) continue;

      const student = students.find(s =>
        (s.admissionNo && s.admissionNo.toLowerCase() === String(identifier).toLowerCase()) ||
        (s.moodleUsername && s.moodleUsername.toLowerCase() === String(identifier).toLowerCase())
      );
      if (!student) continue;

      // Extract subject scores based on column headers e.g., "MTH CA", "MTH EXAM"
      for (const sub of subjects) {
        const caKey = Object.keys(row).find(k => k.trim().toUpperCase() === `${sub.code} CA`);
        const examKey = Object.keys(row).find(k => k.trim().toUpperCase() === `${sub.code} EXAM` || k.trim().toUpperCase() === `${sub.code} EXAM SCORE`);

        if (caKey || examKey) {
          const ca = parseFloat(row[caKey] ?? 0) || 0;
          const exam = parseFloat(row[examKey] ?? 0) || 0;
          const total = Math.round(ca + exam);
          let finalTotal = total;

          let remarkText = gradeRemark(calculateGrade(total));

          // If THIRD term, user requested the Third term to be the average of First, Second, and Third term.
          if (term === 'THIRD') {
            const firstTermResult = await prisma.result.findUnique({
              where: { result_unique: { studentId: student.id, subjectId: sub.id, session, term: 'FIRST' } }
            });
            const secondTermResult = await prisma.result.findUnique({
              where: { result_unique: { studentId: student.id, subjectId: sub.id, session, term: 'SECOND' } }
            });

            const t1 = firstTermResult ? firstTermResult.total : 0;
            const t2 = secondTermResult ? secondTermResult.total : 0;
            const termCount = 1 + (firstTermResult ? 1 : 0) + (secondTermResult ? 1 : 0);

            finalTotal = Math.round((t1 + t2 + total) / 3);
            remarkText = `Cumulative Avg: ${finalTotal} (${gradeRemark(calculateGrade(finalTotal))})`;
          }

          const grade = calculateGrade(finalTotal);

          ops.push(prisma.result.upsert({
            where: { result_unique: { studentId: student.id, subjectId: sub.id, session, term } },
            update: { caScore: ca, examScore: exam, total: finalTotal, grade, remark: remarkText },
            create: { studentId: student.id, subjectId: sub.id, session, term, caScore: ca, examScore: exam, total: finalTotal, grade, remark: remarkText },
          }));
          successCount++;
        }
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }
    res.json({ message: `Successfully uploaded and processed ${successCount} subject records from the complex sheet.`, count: successCount });
  } catch (err) { next(err); }
};

// GET /api/results/psychomotor?classId=&session=&term=
const getPsychomotor = async (req, res, next) => {
  try {
    const { classId, session } = req.query;
    const term = normalizeTerm(req.query.term);

    if (!classId || !session) {
      return res.status(400).json({ message: 'classId and session are required' });
    }

    const students = await prisma.student.findMany({
      where: { currentClassId: classId, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        otherNames: true,
        admissionNo: true,
        photo: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    const allData = readPsychomotor();
    const ratingsMap = {};
    students.forEach(s => {
      const key = `${s.id}_${session}_${term}`;
      ratingsMap[s.id] = allData[key]?.traits || null;
    });

    res.json({ students, ratingsMap });
  } catch (err) { next(err); }
};

// POST /api/results/psychomotor
const savePsychomotor = async (req, res, next) => {
  try {
    const { records, session, classId } = req.body;
    const term = normalizeTerm(req.body.term);

    if (!Array.isArray(records)) {
      return res.status(400).json({ message: 'records array is required' });
    }

    const allData = readPsychomotor();
    let count = 0;

    for (const r of records) {
      if (!r.studentId) continue;
      const rSession = r.session || session;
      const rTerm = normalizeTerm(r.term || term);
      const key = `${r.studentId}_${rSession}_${rTerm}`;

      allData[key] = {
        studentId: r.studentId,
        classId: r.classId || classId || null,
        session: rSession,
        term: rTerm,
        traits: r.traits || {},
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.name || req.user?.email || 'Teacher',
      };
      count++;
    }

    writePsychomotor(allData);
    res.json({ message: `Successfully saved psychomotor ratings for ${count} student(s)`, count });
  } catch (err) { next(err); }
};

module.exports = {
  upload,
  getByStudent,
  getReportCard,
  getBulkReportCards,
  calculate,
  publish,
  uploadTeacherExcel,
  uploadSuperadminExcel,
  getClassScores,
  getPsychomotor,
  savePsychomotor,
};