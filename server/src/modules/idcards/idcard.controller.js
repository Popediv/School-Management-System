const prisma = require('../../config/db');
const { getStoredSettings } = require('../settings/settings.controller');

// Returns student data needed to render the ID card on the frontend
const generate = async (req, res, next) => {
  try {
    const identifier = req.params.studentId?.trim();
    if (!identifier) return res.status(400).json({ message: 'Student ID is required' });

    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: identifier },
          { admissionNo: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        otherNames: true,
        admissionNo: true,
        moodleUsername: true,
        photo: true,
        session: true,
        gender: true,
        currentClass: { select: { id: true, name: true } },
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        otherNames: true,
        admissionNo: true,
        moodleUsername: true,
        photo: true,
        session: true,
        gender: true,
        currentClass: { select: { id: true, name: true } },
      },
      orderBy: { lastName: 'asc' },
    });
    res.json({ students, count: students.length });
  } catch (err) { next(err); }
};

// Public Verification: returns student data and school settings for public QR code scanning
const verify = async (req, res, next) => {
  try {
    const identifier = req.params.studentId?.trim();
    if (!identifier) return res.status(400).json({ message: 'Student ID or Admission No is required' });

    // 1. Load school settings from stored config (safe, no non-existent prisma.setting model)
    const stored = getStoredSettings() || {};
    const settings = {
      schoolName: stored.schoolName || process.env.SCHOOL_NAME || 'PATIMO SCHOOLS INTERNATIONAL',
      logoUrl: stored.logoUrl || null,
      address: stored.address || 'Plot 13&14, Maito Bakery Street, Adesola, Ibadan',
      phone: stored.phone || '+234 803 455 6007',
      email: stored.email || 'info@patimocollege.edu.ng',
      currentSession: stored.currentSession || '2026/2027',
    };

    // 2. Query student by either internal ID, Admission Number, or Moodle Username
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: identifier },
          { admissionNo: { equals: identifier, mode: 'insensitive' } },
          { moodleUsername: { equals: identifier, mode: 'insensitive' } },
        ],
      },
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

    // 3. Fallback for DEMO preview IDs (s1..s4) so demo cards can also verify during testing
    if (!student) {
      const demoMap = {
        s1: { id: 's1', firstName: 'Adaeze', otherNames: 'Chidinma', middleName: 'Chidinma', lastName: 'Okonkwo', admissionNo: 'PCI-2026-0001', gender: 'Female', status: 'ACTIVE', session: '2025/2026', currentClass: { name: 'JSS 1A' }, parentPhone: '+234 803 000 1111' },
        s2: { id: 's2', firstName: 'Emeka', otherNames: 'Tobechukwu', middleName: 'Tobechukwu', lastName: 'Nwosu', admissionNo: 'PCI-2026-0002', gender: 'Male', status: 'ACTIVE', session: '2025/2026', currentClass: { name: 'JSS 1A' }, parentPhone: '+234 803 000 2222' },
        s3: { id: 's3', firstName: 'Chisom', otherNames: 'Blessing', middleName: 'Blessing', lastName: 'Eze', admissionNo: 'PCI-2026-0003', gender: 'Female', status: 'ACTIVE', session: '2025/2026', currentClass: { name: 'JSS 1A' }, parentPhone: '+234 803 000 3333' },
        s4: { id: 's4', firstName: 'Tunde', otherNames: 'Oluwafemi', middleName: 'Oluwafemi', lastName: 'Bakare', admissionNo: 'PCI-2026-0004', gender: 'Male', status: 'ACTIVE', session: '2025/2026', currentClass: { name: 'JSS 1A' }, parentPhone: '+234 803 000 4444' },
      };

      const demo = demoMap[identifier] || Object.values(demoMap).find(d => d.admissionNo.toLowerCase() === identifier.toLowerCase());
      if (demo) {
        return res.json({
          verified: true,
          student: demo,
          settings,
        });
      }

      return res.status(404).json({ message: 'Student verification record not found in register' });
    }

    // Flatten parent phone for frontend compatibility
    const studentData = { ...student, parentPhone: student.parent?.phone || null };
    delete studentData.parent;

    res.json({
      verified: true,
      student: studentData,
      settings,
    });
  } catch (err) { next(err); }
};

module.exports = { generate, bulkGenerate, verify };
