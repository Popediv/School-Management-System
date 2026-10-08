const prisma = require('../../config/db');

// Returns student data needed to render the ID card on the frontend
const generate = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      include: { currentClass: { select: { name: true } } },
      select: {
        id: true, firstName: true, lastName: true, otherNames: true,
        admissionNo: true, moodleUsername: true, photo: true, session: true,
        gender: true, currentClass: true,
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
        id: true, firstName: true, lastName: true, otherNames: true,
        admissionNo: true, moodleUsername: true, photo: true, session: true,
        gender: true, currentClass: true,
      },
    });
    res.json({ students, count: students.length });
  } catch (err) { next(err); }
};

// Public Verification: returns student data and school settings for public QR code scanning
const verify = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        otherNames: true,
        admissionNo: true,
        photo: true,
        session: true,
        status: true,
        gender: true,
        moodleUsername: true,
        parent: { select: { phone: true } },
        currentClass: { select: { name: true } },
      },
    });

    if (!student) return res.status(404).json({ message: 'Student verification record not found' });

    // Flatten parent phone for frontend compatibility
    const studentData = { ...student, parentPhone: student.parent?.phone || null };
    delete studentData.parent;

    const settings = await prisma.setting.findFirst() || {};

    res.json({
      verified: true,
      student: studentData,
      settings: {
        schoolName: settings.schoolName || 'PATIMO SCHOOLS INTERNATIONAL',
        logoUrl: settings.logoUrl || null,
        address: settings.address || 'Plot 13&14, Maito Bakery Street, Adesola, Ibadan',
        phone: settings.phone || '+234 803 455 6007',
        email: settings.email || 'info@patimocollege.edu.ng',
      }
    });
  } catch (err) { next(err); }
};

module.exports = { generate, bulkGenerate, verify };
