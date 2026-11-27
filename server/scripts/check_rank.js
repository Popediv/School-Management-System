require("dotenv").config();
const prisma = require("../src/config/db");

(async () => {
  try {
    const students = await prisma.student.findMany({
      include: {
        results: {
          select: { subjectId: true, caScore: true, examScore: true, total: true, session: true, term: true }
        },
        currentClass: true
      }
    });

    // Group by class
    const byClass = {};
    for (const s of students) {
      const clsName = s.currentClass ? s.currentClass.name : 'Unknown';
      if (!byClass[clsName]) byClass[clsName] = [];
      if (s.results.length > 0) {
        const sum = s.results.reduce((acc, r) => acc + (r.total || 0), 0);
        const avg = sum / s.results.length;
        byClass[clsName].push({
          name: `${s.firstName} ${s.lastName}`,
          subjectsCount: s.results.length,
          total: sum,
          avg: parseFloat(avg.toFixed(2))
        });
      }
    }

    for (const [cls, list] of Object.entries(byClass)) {
      if (list.length > 0) {
        console.log(`\n=== CLASS: ${cls} ===`);
        // Sort by total desc
        const sortedByTotal = [...list].sort((a, b) => b.total - a.total);
        console.log('--- Ranked by TOTAL SCORE: ---');
        sortedByTotal.forEach((item, idx) => {
          console.log(`${idx + 1}. ${item.name} | Total: ${item.total} | Subjects: ${item.subjectsCount} | Avg: ${item.avg}`);
        });

        // Sort by avg desc
        const sortedByAvg = [...list].sort((a, b) => b.avg - a.avg);
        console.log('--- Ranked by AVERAGE: ---');
        sortedByAvg.forEach((item, idx) => {
          console.log(`${idx + 1}. ${item.name} | Avg: ${item.avg} | Total: ${item.total} | Subjects: ${item.subjectsCount}`);
        });
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
