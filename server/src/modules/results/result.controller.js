const prisma = require('../../config/db');
const { calculateGrade, gradeRemark, calculatePositions } = require('../../utils/grading');

// ── Term normalizer ───────────────────────────────────────────────────────────
// Accepts any reasonable format and returns the Prisma enum value
const normalizeTerm = (raw) => {
  if (!raw) return 'FIRST';
  const s = String(raw).trim().toUpperCase();
  if (s === 'FIRST'  || s === 'FIRST TERM'  || s === '1' || s === '1ST') return 'FIRST';
  if (s === 'second' || s === 'SECOND TERM' || s === '2' || s === '2ND') return 'SECOND';
  if (s === 'third'  || s === 'THIRD TERM'  || s === '3' || s === '3RD') return 'THIRD';
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
      const yr  = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const defaultSession = `${yr}/${yr + 1}`;

      const ops = records.map(r => {
        const studentId = r.studentId;
        const subjectId = r.subjectId;
        const term      = normalizeTerm(r.term);
        const session   = r.session || defaultSession;
        const ca        = parseFloat(r.ca    ?? r.caScore  ?? 0);
        const exam      = parseFloat(r.exam  ?? r.examScore ?? 0);
        const total     = ca + exam;
        const grade     = calculateGrade(total);
        const remark    = gradeRemark(grade);

        return prisma.result.upsert({
          where:  { studentId_subjectId_session_term: { studentId, subjectId, session, term } },
          update: { caScore: ca, examScore: exam, total, grade, remark },
          create: { studentId, subjectId, session, term, caScore: ca, examScore: exam, total, grade, remark },
        });
      });

      const results = await prisma.$transaction(ops);
      return res.status(201).json({ message: `${results.length} result(s) saved`, results });
    }

    // ── Single mode ───────────────────────────────────────────────────────────
    const { studentId, subjectId, session, caScore, examScore } = req.body;
    const term = normalizeTerm(req.body.term);

    if (!studentId || !subjectId || !session || !term)
      return res.status(400).json({ message: 'studentId, subjectId, session, term are required' });

    const ca    = parseFloat(caScore)  || 0;
    const exam  = parseFloat(examScore) || 0;
    const total = ca + exam;
    const grade  = calculateGrade(total);
    const remark = gradeRemark(grade);

    const result = await prisma.result.upsert({
      where:  { studentId_subjectId_session_term: { studentId, subjectId, session, term } },
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
      ...(term    && { term }),
    };

    const results = await prisma.result.findMany({
      where,
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });

    res.json({ results });
  } catch (err) { next(err); }
};

// GET /api/results/report-card/:studentId?session=&term=
const getReportCard = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { session } = req.query;
    const term = req.query.term ? normalizeTerm(req.query.term) : undefined;
 
    const [student, results, attendances] = await Promise.all([
      prisma.student.findUnique({
        where:   { id: studentId },
        include: {
          currentClass: true,
          parent: { select: { name: true } },
        },
      }),
 
      prisma.result.findMany({
        where: {
          studentId,
          ...(session && { session }),
          ...(term    && { term }),
          // ✅ no published filter — show all uploaded results
        },
        include: { subject: { select: { name: true, code: true } } },
        orderBy: { subject: { name: 'asc' } },
      }),
 
      // Attendance for this student
      prisma.attendance.groupBy({
        by:     ['status'],
        _count: { status: true },
        where:  { studentId },
      }),
    ]);
 
    if (!student) return res.status(404).json({ message: 'Student not found' });
 
    const attPresent = attendances.find(a => a.status === 'PRESENT')?._count.status || 0;
    const attAbsent  = attendances.find(a => a.status === 'ABSENT')?._count.status  || 0;
    const attLate    = attendances.find(a => a.status === 'LATE')?._count.status    || 0;
    const attTotal   = attPresent + attAbsent + attLate;
    const attRate    = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;
 
    const totalScore = results.reduce((s, r) => s + r.total, 0);
    const average    = results.length
      ? (totalScore / results.length).toFixed(1)
      : 0;
 
    res.json({
      student: {
        ...student,
        attendance: { present: attPresent, absent: attAbsent, late: attLate, rate: attRate },
      },
      results,
      summary: {
        totalScore,
        average,
        subjectCount: results.length,
      },
    });
  } catch (err) { next(err); }
};
 

// POST /api/results/calculate — bulk position calculation for a class + subject
const calculate = async (req, res, next) => {
  try {
    const { classId, subjectId, session } = req.body;
    const term = normalizeTerm(req.body.term);

    const students = await prisma.student.findMany({
      where:  { currentClassId: classId },
      select: { id: true },
    });
    const studentIds = students.map(s => s.id);

    const results = await prisma.result.findMany({
      where:  { studentId: { in: studentIds }, subjectId, session, term },
      select: { id: true, studentId: true, total: true },
    });

    const positions = calculatePositions(results);

    const updates = Object.entries(positions).map(([sid, pos]) =>
      prisma.result.updateMany({
        where: { studentId: sid, subjectId, session, term },
        data:  { position: pos },
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
      data:  { published: true },
    });
    res.json({ message: 'Result published' });
  } catch (err) { next(err); }
};

module.exports = { upload, getByStudent, getReportCard, calculate, publish };