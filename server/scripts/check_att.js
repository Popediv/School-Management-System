require("dotenv").config();
const prisma = require("../src/config/db");

(async () => {
  const cls = await prisma.class.findFirst({ where: { name: 'SSS1A' } });
  const students = await prisma.student.findMany({ where: { currentClassId: cls.id } });
  for (const s of students) {
    const att = await prisma.attendance.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { studentId: s.id }
    });
    console.log(`${s.firstName} ${s.lastName} Attendance:`, att);
  }
  process.exit(0);
})();
