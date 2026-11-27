require("dotenv").config();
const prisma = require("../src/config/db");
const { calculateGrade, gradeRemark, calculatePositions, formatPosition } = require('../src/utils/grading');

(async () => {
  try {
    const classes = await prisma.class.findMany();
    for (const cls of classes) {
      const students = await prisma.student.findMany({
        where: { currentClassId: cls.id },
        include: { currentClass: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      if (!students.length) continue;
      const sids = students.map(s => s.id);
      const [allResults, allAttendances] = await Promise.all([
        prisma.result.findMany({
          where: { studentId: { in: sids } },
          include: { subject: true }
        }),
        prisma.attendance.groupBy({
          by: ['studentId', 'status'],
          _count: { status: true },
          where: { studentId: { in: sids } }
        })
      ]);

      const attMap = {};
      for (const a of allAttendances) {
        if (!attMap[a.studentId]) attMap[a.studentId] = { P: 0, A: 0, L: 0 };
        if (a.status === 'PRESENT') attMap[a.studentId].P = a._count.status;
        if (a.status === 'ABSENT') attMap[a.studentId].A = a._count.status;
        if (a.status === 'LATE') attMap[a.studentId].L = a._count.status;
      }

      // Group results by student
      const resByStudent = {};
      for (const r of allResults) {
        if (!resByStudent[r.studentId]) resByStudent[r.studentId] = [];
        resByStudent[r.studentId].push(r);
      }

      // Let's compute each student's processed total & average
      const studentMetrics = students.map(s => {
        const att = attMap[s.id] || { P: 0, A: 0, L: 0 };
        const totAtt = att.P + att.A + att.L;
        const attScore = totAtt ? Math.round((att.P / totAtt) * 10 * 10) / 10 : 0;

        const sResults = resByStudent[s.id] || [];
        const processed = sResults.map(r => {
          const combinedCA = Math.min(30, Math.round(((r.caScore || 0) + attScore) * 10) / 10);
          const total = Math.round(combinedCA + (r.examScore || 0));
          return total;
        });

        const sum = processed.reduce((a, b) => a + b, 0);
        const avg = processed.length ? parseFloat((sum / processed.length).toFixed(1)) : 0;
        return {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          subjects: processed.length,
          total: sum,
          avg
        };
      });

      // Check current ranking logic (which ranks by sum of raw r.total)
      const rawRankings = calculatePositions(
        students.map(s => {
          const sResults = resByStudent[s.id] || [];
          const rawSum = sResults.reduce((a, r) => a + (r.total ? Math.round(r.total) : 0), 0);
          return { studentId: s.id, total: rawSum };
        })
      );

      // Check if ranked by processed total
      const processedTotalRankings = calculatePositions(
        studentMetrics.map(m => ({ studentId: m.id, total: m.total }))
      );

      // Check if ranked by AVERAGE
      const avgRankings = calculatePositions(
        studentMetrics.map(m => ({ studentId: m.id, total: m.avg }))
      );

      console.log(`\n================== ${cls.name} (${cls.level}) ==================`);
      for (const m of studentMetrics) {
        if (m.subjects > 0) {
          const curPos = rawRankings[m.id];
          const procPos = processedTotalRankings[m.id];
          const avgPos = avgRankings[m.id];
          console.log(
            `${m.name.padEnd(22)} | Subj: ${String(m.subjects).padEnd(2)} | Total: ${String(m.total).padEnd(4)} | Avg: ${String(m.avg).padEnd(5)} | Current Pos: ${curPos} | ByAvg Pos: ${avgPos}`
          );
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
