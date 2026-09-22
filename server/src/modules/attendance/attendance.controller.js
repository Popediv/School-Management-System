const prisma = require('../../config/db');

// POST /api/attendance
const mark = async (req, res, next) => {
  try {
    const { classId, date, records } = req.body;
    if (!classId || !date || !Array.isArray(records)) {
      return res.status(400).json({ message: 'classId, date, and records (array) are required' });
    }

    const attendanceDate = new Date(new Date(date).setUTCHours(0, 0, 0, 0));

    const operations = records.map((rec) => {
      return prisma.attendance.upsert({
        where: {
          studentId_classId_date: {
            studentId: rec.studentId,
            classId,
            date: attendanceDate,
          },
        },
        update: {
          status: rec.status,
          remark: rec.remark || null,
        },
        create: {
          studentId: rec.studentId,
          classId,
          date: attendanceDate,
          status: rec.status,
          remark: rec.remark || null,
        },
      });
    });

    await prisma.$transaction(operations);
    res.json({ message: 'Attendance recorded successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/attendance/class/:classId
const getByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    const where = { classId };
    if (date) {
      where.date = new Date(new Date(date).setUTCHours(0, 0, 0, 0));
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
          },
        },
      },
    });

    res.json(records);
  } catch (err) {
    next(err);
  }
};

// GET /api/attendance/student/:studentId
const getByStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        userId: true,
        parent: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Role-based access checks
    if (req.user.role === 'STUDENT' && student.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: cannot view other students attendance' });
    }
    if (req.user.role === 'PARENT' && student.parent?.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: cannot view other students attendance' });
    }

    const records = await prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
    });

    res.json(records);
  } catch (err) {
    next(err);
  }
};

// GET /api/attendance/report
const getReport = async (req, res, next) => {
  try {
    const { classId, startDate, endDate } = req.query;

    const where = {};
    if (classId) {
      where.classId = classId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(new Date(startDate).setUTCHours(0, 0, 0, 0));
      }
      if (endDate) {
        where.date.lte = new Date(new Date(endDate).setUTCHours(23, 59, 59, 999));
      }
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        class: {
          select: {
            name: true,
          },
        },
        student: {
          select: {
            firstName: true,
            lastName: true,
            admissionNo: true,
          },
        },
      },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;

    res.json({
      summary: {
        total,
        present,
        absent,
        late,
        rate: total > 0 ? (present / total) * 100 : 0,
      },
      records,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/attendance/kiosk-scan
const kioskScan = async (req, res, next) => {
  try {
    const { code, fingerprintTemplate } = req.body;
    if (!code && !fingerprintTemplate) {
      return res.status(400).json({ message: 'Barcode/Admission No or Fingerprint scan is required' });
    }

    let student = null;
    if (code) {
      const cleanCode = code.trim();
      student = await prisma.student.findFirst({
        where: {
          OR: [
            { admissionNo: { equals: cleanCode, mode: 'insensitive' } },
            { moodleUsername: { equals: cleanCode, mode: 'insensitive' } },
            { id: cleanCode }
          ],
          status: 'ACTIVE'
        },
        include: { currentClass: { select: { id: true, name: true } } }
      });
    } else if (fingerprintTemplate) {
      student = await prisma.student.findFirst({
        where: { fingerprintTemplate: fingerprintTemplate.trim(), status: 'ACTIVE' },
        include: { currentClass: { select: { id: true, name: true } } }
      });
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found or unrecognized ID/fingerprint' });
    }

    if (!student.currentClassId) {
      return res.status(400).json({ message: 'Student is not currently enrolled in an active class' });
    }

    const today = new Date();
    const attendanceDate = new Date(new Date(today).setUTCHours(0, 0, 0, 0));

    // Determine status: LATE if check-in is after 8:15 AM
    const hours = today.getHours();
    const minutes = today.getMinutes();
    const isLate = hours > 8 || (hours === 8 && minutes > 15);
    const calculatedStatus = isLate ? 'LATE' : 'PRESENT';

    // Check existing attendance for today
    const existing = await prisma.attendance.findUnique({
      where: {
        studentId_classId_date: {
          studentId: student.id,
          classId: student.currentClassId,
          date: attendanceDate
        }
      }
    });

    const record = await prisma.attendance.upsert({
      where: {
        studentId_classId_date: {
          studentId: student.id,
          classId: student.currentClassId,
          date: attendanceDate
        }
      },
      update: {
        status: calculatedStatus,
        remark: `Kiosk check-in at ${today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      },
      create: {
        studentId: student.id,
        classId: student.currentClassId,
        date: attendanceDate,
        status: calculatedStatus,
        remark: `Kiosk check-in at ${today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      }
    });

    res.json({
      message: existing ? `Attendance already recorded for today (${record.status})` : `Successfully marked ${calculatedStatus}`,
      alreadyRecorded: !!existing,
      status: record.status,
      time: today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNo: student.admissionNo,
        photo: student.photo,
        className: student.currentClass?.name || 'Unassigned'
      }
    });
  } catch (err) { next(err); }
};

// POST /api/attendance/auto-mark-absent
const autoMarkAbsent = async (req, res, next) => {
  try {
    const { date, classId } = req.body;
    const targetDate = date ? new Date(new Date(date).setUTCHours(0, 0, 0, 0)) : new Date(new Date().setUTCHours(0, 0, 0, 0));

    const studentWhere = { status: 'ACTIVE', currentClassId: { not: null } };
    if (classId) studentWhere.currentClassId = classId;

    const activeStudents = await prisma.student.findMany({
      where: studentWhere,
      select: { id: true, currentClassId: true }
    });

    const existingRecords = await prisma.attendance.findMany({
      where: { date: targetDate },
      select: { studentId: true }
    });
    const recordedIds = new Set(existingRecords.map(r => r.studentId));

    const unscanned = activeStudents.filter(s => !recordedIds.has(s.id));

    if (unscanned.length === 0) {
      return res.json({ message: 'All active students already have attendance recorded for today.', count: 0 });
    }

    const absentOperations = unscanned.map(s => ({
      studentId: s.id,
      classId: s.currentClassId,
      date: targetDate,
      status: 'ABSENT',
      remark: 'Automated kiosk end-of-day absence record'
    }));

    await prisma.attendance.createMany({
      data: absentOperations,
      skipDuplicates: true
    });

    res.json({ message: `Marked ${unscanned.length} unscanned active student(s) as ABSENT.`, count: unscanned.length });
  } catch (err) { next(err); }
};

// POST /api/attendance/save-fingerprint
const saveFingerprint = async (req, res, next) => {
  try {
    const { studentId, fingerprintTemplate } = req.body;
    if (!studentId || !fingerprintTemplate) {
      return res.status(400).json({ message: 'studentId and fingerprintTemplate are required' });
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { fingerprintTemplate: fingerprintTemplate.trim() }
    });

    res.json({ message: 'Fingerprint template saved successfully' });
  } catch (err) { next(err); }
};

module.exports = {
  mark,
  getByClass,
  getByStudent,
  getReport,
  kioskScan,
  autoMarkAbsent,
  saveFingerprint
};
