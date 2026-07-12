const prisma = require('../../config/db');

const getStats = async (req, res, next) => {
  try {
    const [
      studentCount, teacherCount, classCount,
      outstandingFees, newThisTerm,
      recentStudents, enrollmentByMonth,
    ] = await Promise.all([
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.teacher.count(),
      prisma.class.count(),
      prisma.payment.findMany({ where: { status: { in: ['PENDING','PARTIAL'] } } }),
      prisma.student.count({ where: { createdAt: { gte: new Date(new Date().setDate(1)) } } }),
      prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          status: true,
          currentClass: { select: { name: true } },
        },
      }),
      prisma.attendance.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const totalAtt   = enrollmentByMonth.reduce((s, r) => s + r._count.status, 0);
    const presentAtt = enrollmentByMonth.find(r => r.status === 'PRESENT')?._count?.status || 0;
    const attendanceRate = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : 0;

    const months = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        month: d.toLocaleString('default', { month: 'short' }),
        students: studentCount - Math.floor(Math.random() * 5 * i),
      });
    }

    res.json({
      students:        studentCount,
      teachers:        teacherCount,
      classes:         classCount,
      outstandingFees: outstandingFees.reduce((acc, p) => acc + (p.amount - (p.amountPaid || 0)), 0),
      newThisTerm,
      attendanceRate,
      recentStudents: recentStudents.map(s => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        admissionNo: s.admissionNo,
        class: s.currentClass?.name || '—',
        status: s.status,
      })),
      enrollmentChart: months,
    });
  } catch (err) { next(err); }
};

const getTeacherStats = async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      include: {
        assignments: {
          include: {
            class: { include: { _count: { select: { students: true } } } },
            subject: true,
          },
        },
      },
    });

    if (!teacher) return res.status(404).json({ message: 'Teacher profile not found' });

    const myClasses = teacher.assignments.map(a => ({
      id:       a.class.id,
      name:     a.class.name,
      subject:  a.subject.name,
      students: a.class._count.students,
    }));

    const classIds = myClasses.map(c => c.id);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const attendances = await prisma.attendance.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { classId: { in: classIds }, date: { gte: today } },
    });

    const attendanceSummary = {
      present: attendances.find(a => a.status === 'PRESENT')?._count.status || 0,
      absent:  attendances.find(a => a.status === 'ABSENT')?._count.status  || 0,
      late:    attendances.find(a => a.status === 'LATE')?._count.status    || 0,
    };

    const recent = await prisma.attendance.findMany({
      where:   { classId: { in: classIds } },
      orderBy: { date: 'desc' },
      take:    20,
      include: { class: true },
    });

    const recentMap = {};
    recent.forEach(r => {
      const key = `${r.date.toISOString().split('T')[0]}_${r.class.name}`;
      if (!recentMap[key]) {
        recentMap[key] = { date: r.date.toISOString().split('T')[0], class: r.class.name, present: 0, absent: 0, late: 0 };
      }
      if (r.status === 'PRESENT')     recentMap[key].present++;
      else if (r.status === 'ABSENT') recentMap[key].absent++;
      else if (r.status === 'LATE')   recentMap[key].late++;
    });

    res.json({
      myClasses,
      attendanceSummary,
      pendingResults: 0,
      recentAttendance: Object.values(recentMap).slice(0, 5),
    });
  } catch (err) { next(err); }
};

const getBursaryStats = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const unpaidInvoices     = await prisma.payment.findMany({ where: { status: { in: ['PENDING','PARTIAL'] } } });
    const collectedPayments  = await prisma.payment.findMany({ where: { amountPaid: { gt: 0 } } });

    const totalOutstanding = unpaidInvoices.reduce((acc, p) => acc + ((p.amount || 0) - (p.amountPaid || 0)), 0);
    const totalCollected   = collectedPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);

    const [pendingCount, paidTodayCount, recentPayments] = await Promise.all([
      prisma.payment.count({ where: { status: { in: ['PENDING','PARTIAL'] } } }),
      prisma.payment.count({ where: { amountPaid: { gt: 0 }, paidAt: { gte: today } } }),
      prisma.payment.findMany({
        take: 10, orderBy: { paidAt: 'desc' },
        where: { amountPaid: { gt: 0 }, paidAt: { not: null } },
        include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
      }),
    ]);

    const monthlyChart = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthPayments = await prisma.payment.findMany({
        where: { paidAt: { gte: startOfMonth, lte: endOfMonth }, amountPaid: { gt: 0 } },
        select: { amountPaid: true },
      });
      monthlyChart.push({
        month:     d.toLocaleString('default', { month: 'short' }),
        collected: monthPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0),
      });
    }

    res.json({
      totalOutstanding,
      totalCollected,
      pendingInvoices: pendingCount,
      paidToday:       paidTodayCount,
      recentPayments:  recentPayments.map(p => ({
        id:          p.id,
        studentName: `${p.student.firstName} ${p.student.lastName}`,
        admissionNo: p.student.admissionNo,
        amount:      p.amountPaid,
        type:        p.description,
        date:        p.paidAt ? p.paidAt.toISOString().split('T')[0] : p.createdAt.toISOString().split('T')[0],
        status:      p.status,
      })),
      monthlyChart,
    });
  } catch (err) { next(err); }
};

const getParentStats = async (req, res, next) => {
  try {
    const parent = await prisma.parent.findUnique({
      where:   { userId: req.user.id },
      include: { children: { include: { currentClass: true } } },
    });

    if (!parent || !parent.children?.length) {
      return res.json({
        child: null,
        attendance: { present: 0, absent: 0, late: 0, rate: 0 },
        termResult: { avg: null, position: null },
        feeBalance: { outstanding: 0 },
        notifications: [],
      });
    }

    const childStudent = parent.children[0];

    const attendances = await prisma.attendance.groupBy({
      by: ['status'], _count: { status: true },
      where: { studentId: childStudent.id },
    });

    const attPresent = attendances.find(a => a.status === 'PRESENT')?._count.status || 0;
    const attAbsent  = attendances.find(a => a.status === 'ABSENT')?._count.status  || 0;
    const attLate    = attendances.find(a => a.status === 'LATE')?._count.status    || 0;
    const attTotal   = attPresent + attAbsent + attLate;
    const attRate    = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

    const allPayments = await prisma.payment.findMany({
      where: { studentId: childStudent.id }, orderBy: { createdAt: 'desc' },
    });
    const outstanding = allPayments
      .filter(p => p.status !== 'PAID')
      .reduce((acc, p) => acc + (p.amount - (p.amountPaid || 0)), 0);

    res.json({
      child: {
        name:        `${childStudent.firstName} ${childStudent.lastName}`,
        admissionNo: childStudent.admissionNo,
        class:       childStudent.currentClass?.name || '—',
        session:     childStudent.session,
      },
      attendance: { present: attPresent, absent: attAbsent, late: attLate, rate: attRate },
      termResult: { avg: '—', position: '—' },
      feeBalance: { outstanding: outstanding || 0 },
      payments: allPayments.map(p => ({
        id:          p.id,
        description: p.description,
        amount:      p.amount,
        amountPaid:  p.amountPaid || 0,
        balance:     p.amount - (p.amountPaid || 0),
        status:      p.status,
        date:        p.createdAt.toISOString().split('T')[0],
      })),
      notifications: [
        { id:'n1', title:'Welcome to Patimo College Portal', message:"Keep track of your child's progress here.", date: new Date().toISOString().split('T')[0] },
      ],
    });
  } catch (err) { next(err); }
};

// ── Helper: derive current academic session & term ────────────────────────────
function currentSessionAndTerm() {
  const now   = new Date();
  const month = now.getMonth() + 1; // 1-based
  const yr    = month >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const session = `${yr}/${yr + 1}`;

  // Sept–Dec → FIRST | Jan–Apr → SECOND | May–Aug → THIRD
  const term = month >= 9 ? 'FIRST' : month >= 5 ? 'THIRD' : 'SECOND';

  return { session, term };
}

const getStudentStats = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where:   { userId: req.user.id },
      include: { currentClass: true },
    });

    if (!student) {
      return res.json({
        student:       null,
        attendance:    { rate: 0, present: 0, absent: 0, late: 0 },
        results:       [],
        position:      '—',
        avg:           '—',
        notifications: [],
        feeBalance:    { outstanding: 0 },
        payments:      [],
      });
    }

    // ── Attendance ────────────────────────────────────────────────────────────
    const attendances = await prisma.attendance.groupBy({
      by: ['status'], _count: { status: true },
      where: { studentId: student.id },
    });

    const attPresent = attendances.find(a => a.status === 'PRESENT')?._count.status || 0;
    const attAbsent  = attendances.find(a => a.status === 'ABSENT')?._count.status  || 0;
    const attLate    = attendances.find(a => a.status === 'LATE')?._count.status    || 0;
    const attTotal   = attPresent + attAbsent + attLate;
    const attRate    = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

    // ── Results ───────────────────────────────────────────────────────────────
    // Use current session/term as default; show ALL results if none recorded yet
    const { session: currentSession, term: currentTerm } = currentSessionAndTerm();

    // Try current term first
    let results = await prisma.result.findMany({
      where: {
        studentId: student.id,
        session:   currentSession,
        term:      currentTerm,
        // ✅ removed published: true — show all uploaded results
      },
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    });

    // If no results for current term, fall back to the most recent available term
    if (!results.length) {
      const latest = await prisma.result.findFirst({
        where:   { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        select:  { session: true, term: true },
      });

      if (latest) {
        results = await prisma.result.findMany({
          where: { studentId: student.id, session: latest.session, term: latest.term },
          include: { subject: { select: { name: true, code: true } } },
          orderBy: { subject: { name: 'asc' } },
        });
      }
    }

    // Shape results for the frontend
    const resultsList = results.map(r => ({
      id:      r.id,
      subject: r.subject.name,   // ← plain string so JSX works
      code:    r.subject.code,
      ca:      r.caScore,        // ← matches frontend r.ca
      exam:    r.examScore,      // ← matches frontend r.exam
      total:   r.total,
      grade:   r.grade,
      remark:  r.remark,
    }));

    const totalScore = results.reduce((sum, r) => sum + r.total, 0);
    const avgScore   = results.length
      ? (Math.round((totalScore / results.length) * 10) / 10)
      : null;

    // ── Fees / Payments ───────────────────────────────────────────────────────
    const allPayments = await prisma.payment.findMany({
      where:   { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });

    const outstanding = allPayments
      .filter(p => p.status !== 'PAID')
      .reduce((acc, p) => acc + ((p.amount || 0) - (p.amountPaid || 0)), 0);

    res.json({
      student: {
        name:        `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        class:       student.currentClass?.name || '—',
        session:     currentSession,
        term:        currentTerm,
      },
      attendance: { rate: attRate, present: attPresent, absent: attAbsent, late: attLate },
      results:    resultsList,
      feeBalance: { outstanding: outstanding || 0 },
      payments:   allPayments.map(p => ({
        id:          p.id,
        description: p.description,
        amount:      p.amount,
        amountPaid:  p.amountPaid || 0,
        balance:     (p.amount || 0) - (p.amountPaid || 0),
        status:      p.status,
        date:        p.createdAt.toISOString().split('T')[0],
      })),
      position: '—',
      avg:      avgScore ?? '—',
      notifications: [
        {
          id: 'n1',
          title:   'Welcome to Patimo College Portal',
          message: 'Your dashboard shows your term academic overview, attendance records, and notices.',
          date:    new Date().toISOString().split('T')[0],
        },
      ],
    });
  } catch (err) { next(err); }
};

module.exports = { getStats, getTeacherStats, getBursaryStats, getParentStats, getStudentStats };