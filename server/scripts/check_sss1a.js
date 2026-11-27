require("dotenv").config();
const prisma = require("../src/config/db");

(async () => {
  const cls = await prisma.class.findFirst({ where: { name: 'SSS1A' } });
  const students = await prisma.student.findMany({ where: { currentClassId: cls.id } });
  for (const s of students) {
    const res = await prisma.result.findMany({ where: { studentId: s.id } });
    const rawSum = res.reduce((a, b) => a + (b.total || 0), 0);
    console.log(`${s.firstName} ${s.lastName}: Raw DB Total = ${rawSum}`);
    res.forEach(r => {
      console.log(`   subj: ${r.subjectId} ca: ${r.caScore} exam: ${r.examScore} total: ${r.total}`);
    });
  }
  process.exit(0);
})();
