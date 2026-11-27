require("dotenv").config();
const prisma = require("../src/config/db");

// Updated calculatePositions supporting primary score (average) and secondary score (total)
function calculatePositions(items) {
  const sorted = [...items].sort((a, b) => {
    const scoreA = Number(a.score ?? a.total ?? 0);
    const scoreB = Number(b.score ?? b.total ?? 0);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    const secA = Number(a.secondaryScore ?? 0);
    const secB = Number(b.secondaryScore ?? 0);
    return secB - secA;
  });

  const positions = {};
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    const curScore = Number(cur.score ?? cur.total ?? 0);
    const prevScore = prev ? Number(prev.score ?? prev.total ?? 0) : null;
    const curSec = Number(cur.secondaryScore ?? 0);
    const prevSec = prev ? Number(prev.secondaryScore ?? 0) : null;

    if (i > 0 && curScore === prevScore && curSec === prevSec) {
      positions[cur.studentId] = positions[prev.studentId];
    } else {
      positions[cur.studentId] = i + 1;
    }
  }
  return positions;
}

(async () => {
  const cls = await prisma.class.findFirst({ where: { name: 'SSS1A' } });
  const students = await prisma.student.findMany({
    where: { currentClassId: cls.id },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });
  const sids = students.map(s => s.id);
  const [allResults, allAttendances] = await Promise.all([
    prisma.result.findMany({ where: { studentId: { in: sids } } }),
    prisma.attendance.groupBy({ by: ['studentId', 'status'], _count: { status: true }, where: { studentId: { in: sids } } })
  ]);

  const attMap = {};
  for (const a of allAttendances) {
    if (!attMap[a.studentId]) attMap[a.studentId] = { P: 0, A: 0, L: 0 };
    if (a.status === 'PRESENT') attMap[a.studentId].P = a._count.status;
    if (a.status === 'ABSENT') attMap[a.studentId].A = a._count.status;
    if (a.status === 'LATE') attMap[a.studentId].L = a._count.status;
  }

  const resByStudent = {};
  for (const r of allResults) {
    if (!resByStudent[r.studentId]) resByStudent[r.studentId] = [];
    resByStudent[r.studentId].push(r);
  }

  const metrics = students.map(s => {
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
      studentId: s.id,
      name: `${s.firstName} ${s.lastName}`,
      subjects: processed.length,
      total: sum,
      score: avg,
      secondaryScore: sum,
    };
  });

  const positions = calculatePositions(metrics);

  console.log('=== SSS1A NEW POSITION LOGIC ===');
  // Sort descending by position
  const sorted = [...metrics].sort((a, b) => positions[a.studentId] - positions[b.studentId]);
  sorted.forEach(m => {
    console.log(`Position ${positions[m.studentId]}: ${m.name} | Average: ${m.score} | Total: ${m.total} | Subjects: ${m.subjects}`);
  });
  process.exit(0);
})();
