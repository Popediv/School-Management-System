const prisma = require('../../config/db');

// ─── Admin Dashboard Stats ───────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth  = new Date(new Date().setDate(1));

    const [
      studentCount, teacherCount, classCount,
      newThisTerm,
      recentStudents,
      // Aggregate outstanding fees — avoids fetching entire payments table
      outstandingAgg,
      enrollmentByMonth,
    ] = await Promise.all([
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.teacher.count(),
      prisma.class.count(),
      prisma.student.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id:           true,
          firstName:    true,
          lastName:     true,
          admissionNo:  true,
          status:       true,
          currentClass: { select: { name: true } },
        },
      }),
      // Use aggregate to sum outstanding without loading every row
      prisma.payment.aggregate({
        where:   { status: { in: ['PENDING', 'PARTIAL'] } },
        _sum:    { amount: true, amountPaid: true },
      }),
      prisma.attendance.groupBy({
        by:    ['status'],
        _count: { status: true },
        where:  { date: { gte: thirtyDaysAgo } },
      }),
    ]);

    const totalAtt    = enrollmentByMonth.reduce((s, r) => s + r._count.status, 0);
    const presentAtt  = enrollmentByMonth.find(r => r.status === 'PRESENT')?._count?.status || 0;
    const attendanceRate = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : 0;

    const totalAmount  = outstandingAgg._sum.amount   || 0;
    const totalPaid    = outstandingAgg._sum.amountPaid || 0;
    const outstandingFees = totalAmount - totalPaid;

    const months = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        month:    d.toLocaleString('default', { month: 'short' }),
        students: studentCount - Math.floor(Math.random() * 5 * i),
      });
    }

    res.json({
      students:        studentCount,
      teachers:        teacherCount,
      classes:         classCount,
      outstandingFees,
      newThisTerm,
      attendanceRate,
      recentStudents: recentStudents.map(s => ({
        id:          s.id,
        name:        `${s.firstName} ${s.lastName}`,
        admissionNo: s.admissionNo,
        class:       s.currentClass?.name || '—',
        status:      s.status,
      })),
      enrollmentChart: months,
    });
  } catch (err) { next(err); }
};

// ─── Teacher Dashboard Stats ─────────────────────────────────────────────────
const getTeacherStats = async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where:   { userId: req.user.id },
      include: {
        assignments: {
          include: {
            class:   { include: { _count: { select: { students: true } } } },
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
    const today    = new Date(); today.setHours(0, 0, 0, 0);

    const [attendances, recent] = await Promise.all([
      prisma.attendance.groupBy({
        by:    ['status'],
        _count: { status: true },
        where:  { classId: { in: classIds }, date: { gte: today } },
      }),
      prisma.attendance.findMany({
        where:   { classId: { in: classIds } },
        orderBy: { date: 'desc' },
        take:    20,
        include: { class: true },
      }),
    ]);

    const attendanceSummary = {
      present: attendances.find(a => a.status === 'PRESENT')?._count.status || 0,
      absent:  attendances.find(a => a.status === 'ABSENT')?._count.status  || 0,
      late:    attendances.find(a => a.status === 'LATE')?._count.status    || 0,
    };

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
      pendingResults:   0,
      recentAttendance: Object.values(recentMap).slice(0, 5),
    });
  } catch (err) { next(err); }
};

// ─── Bursary Dashboard Stats ─────────────────────────────────────────────────
const getBursaryStats = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Build 5 month boundaries upfront so we can batch all queries
    const monthRanges = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthRanges.push({
        label:  d.toLocaleString('default', { month: 'short' }),
        start:  new Date(d.getFullYear(), d.getMonth(), 1),
        end:    new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      });
    }

    // All heavy queries in one parallel batch — zero sequential round-trips
    const [
      outstandingAgg,
      collectedAgg,
      pendingCount,
      paidTodayCount,
      recentPayments,
      ...monthlyAggs
    ] = await Promise.all([
      // Outstanding: sum what's still owed without loading rows
      prisma.payment.aggregate({
        where: { status: { in: ['PENDING', 'PARTIAL'] } },
        _sum:  { amount: true, amountPaid: true },
      }),
      // Total collected: aggregate across all payments with any paid amount
      prisma.payment.aggregate({
        where: { amountPaid: { gt: 0 } },
        _sum:  { amountPaid: true },
      }),
      prisma.payment.count({ where: { status: { in: ['PENDING', 'PARTIAL'] } } }),
      prisma.payment.count({ where: { amountPaid: { gt: 0 }, paidAt: { gte: today } } }),
      prisma.payment.findMany({
        take: 10, orderBy: { paidAt: 'desc' },
        where:   { amountPaid: { gt: 0 }, paidAt: { not: null } },
        include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
      }),
      // 5 monthly aggregates — all run in parallel with the rest
      ...monthRanges.map(m =>
        prisma.payment.aggregate({
          where: { paidAt: { gte: m.start, lte: m.end }, amountPaid: { gt: 0 } },
          _sum:  { amountPaid: true },
        })
      ),
    ]);

    const totalOutstanding = (outstandingAgg._sum.amount || 0) - (outstandingAgg._sum.amountPaid || 0);
    const totalCollected   = collectedAgg._sum.amountPaid || 0;

    const monthlyChart = monthRanges.map((m, idx) => ({
      month:     m.label,
      collected: monthlyAggs[idx]._sum.amountPaid || 0,
    }));

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
        date:        p.paidAt ? p.paidAt.toISOString().split('T')[0] : '',
        status:      p.status,
      })),
      monthlyChart,
    });
  } catch (err) { next(err); }
};

// ─── Parent Dashboard Stats ───────────────────────────────────────────────────
const getParentStats = async (req, res, next) => {
  try {
    const parent = await prisma.parent.findUnique({
      where:   { userId: req.user.id },
      include: { children: { include: { currentClass: true } } },
    });

    if (!parent || !parent.children?.length) {
      return res.json({
        child:         null,
        attendance:    { present: 0, absent: 0, late: 0, rate: 0 },
        termResult:    { avg: null, position: null },
        feeBalance:    { outstanding: 0 },
        notifications: [],
      });
    }

    const childStudent = parent.children[0];

    const [attendances, allPayments] = await Promise.all([
      prisma.attendance.groupBy({
        by: ['status'], _count: { status: true },
        where: { studentId: childStudent.id },
      }),
      prisma.payment.findMany({
        where: { studentId: childStudent.id }, orderBy: { createdAt: 'desc' },
      }),
    ]);

    const attPresent = attendances.find(a => a.status === 'PRESENT')?._count.status || 0;
    const attAbsent  = attendances.find(a => a.status === 'ABSENT')?._count.status  || 0;
    const attLate    = attendances.find(a => a.status === 'LATE')?._count.status    || 0;
    const attTotal   = attPresent + attAbsent + attLate;
    const attRate    = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

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
        { id: 'n1', title: 'Welcome to Patimo College Portal', message: "Keep track of your child's progress here.", date: new Date().toISOString().split('T')[0] },
      ],
    });
  } catch (err) { next(err); }
};

// ─── Helper: derive current academic session & term ───────────────────────────
function currentSessionAndTerm() {
  const now   = new Date();
  const month = now.getMonth() + 1; // 1-based
  const yr    = month >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const session = `${yr}/${yr + 1}`;
  // Sept–Dec → FIRST | Jan–Apr → SECOND | May–Aug → THIRD
  const term = month >= 9 ? 'FIRST' : month >= 5 ? 'THIRD' : 'SECOND';
  return { session, term };
}

// ─── Student Dashboard Stats ──────────────────────────────────────────────────
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

    const { session: currentSession, term: currentTerm } = currentSessionAndTerm();

    // All independent queries in parallel
    const [attendances, termResults, allPayments] = await Promise.all([
      prisma.attendance.groupBy({
        by: ['status'], _count: { status: true },
        where: { studentId: student.id },
      }),
      prisma.result.findMany({
        where:   { studentId: student.id, session: currentSession, term: currentTerm },
        include: { subject: { select: { name: true, code: true } } },
        orderBy: { subject: { name: 'asc' } },
      }),
      prisma.payment.findMany({
        where:   { studentId: student.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const attPresent = attendances.find(a => a.status === 'PRESENT')?._count.status || 0;
    const attAbsent  = attendances.find(a => a.status === 'ABSENT')?._count.status  || 0;
    const attLate    = attendances.find(a => a.status === 'LATE')?._count.status    || 0;
    const attTotal   = attPresent + attAbsent + attLate;
    const attRate    = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

    // Fallback to most recent term if current term has no results
    let results = termResults;
    if (!results.length) {
      const latest = await prisma.result.findFirst({
        where:   { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        select:  { session: true, term: true },
      });
      if (latest) {
        results = await prisma.result.findMany({
          where:   { studentId: student.id, session: latest.session, term: latest.term },
          include: { subject: { select: { name: true, code: true } } },
          orderBy: { subject: { name: 'asc' } },
        });
      }
    }

    const resultsList = results.map(r => ({
      id:      r.id,
      subject: r.subject.name,
      code:    r.subject.code,
      ca:      r.caScore,
      exam:    r.examScore,
      total:   r.total,
      grade:   r.grade,
      remark:  r.remark,
    }));

    const totalScore = results.reduce((sum, r) => sum + r.total, 0);
    const avgScore   = results.length ? (Math.round((totalScore / results.length) * 10) / 10) : null;

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
      position:      '—',
      avg:           avgScore ?? '—',
      notifications: [
        {
          id:      'n1',
          title:   'Welcome to Patimo College Portal',
          message: 'Your dashboard shows your term academic overview, attendance records, and notices.',
          date:    new Date().toISOString().split('T')[0],
        },
      ],
    });
  } catch (err) { next(err); }
};

module.exports = { getStats, getTeacherStats, getBursaryStats, getParentStats, getStudentStats };