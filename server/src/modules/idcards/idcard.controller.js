const prisma = require('../../config/db');

// Returns student data needed to render the ID card on the frontend
const generate = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      include: { currentClass: { select: { name: true } } },
      select: {
        id: true, firstName: true, lastName: true,
        admissionNo: true, photo: true, session: true,
        currentClass: true,
      },
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ student });
  } catch (err) { next(err); }
};

// Bulk: returns array of students for a class
const bulkGenerate = async (req, res, next) => {
  try {
    const { ids, classId } = req.body;
    const where = ids?.length ? { id: { in: ids } } : (classId ? { currentClassId: classId } : {});

    const students = await prisma.student.findMany({
      where,
      include: { currentClass: { select: { name: true } } },
      select: {
        id: true, firstName: true, lastName: true,
        admissionNo: true, photo: true, session: true,
        currentClass: true,
      },
    });
    res.json({ students, count: students.length });
  } catch (err) { next(err); }
};

module.exports = { generate, bulkGenerate };
