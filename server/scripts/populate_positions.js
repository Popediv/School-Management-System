const prisma = require('../src/config/db');
const { calculatePositions } = require('../src/utils/grading');

async function populateAllPositions() {
  const session = '2026/2027';
  const term = 'FIRST';
  const classes = await prisma.class.findMany({ select: { id: true, name: true } });
  const subjects = await prisma.subject.findMany({ select: { id: true, name: true } });

  let updatedCount = 0;
  for (const c of classes) {
    const students = await prisma.student.findMany({ where: { currentClassId: c.id }, select: { id: true } });
    if (!students.length) continue;
    const studentIds = students.map(s => s.id);

    for (const sub of subjects) {
      const results = await prisma.result.findMany({
        where: { studentId: { in: studentIds }, subjectId: sub.id, session, term },
        select: { id: true, studentId: true, total: true }
      });
      if (!results.length) continue;

      const posMap = calculatePositions(results);
      for (const [sid, pos] of Object.entries(posMap)) {
        await prisma.result.updateMany({
          where: { studentId: sid, subjectId: sub.id, session, term },
          data: { position: pos }
        });
        updatedCount++;
      }
    }
  }

  console.log(`Successfully populated positions for ${updatedCount} records in database!`);
  process.exit(0);
}

populateAllPositions().catch(e => {
  console.error(e);
  process.exit(1);
});
