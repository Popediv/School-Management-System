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

module.exports = {
  mark,
  getByClass,
  getByStudent,
  getReport,
};
