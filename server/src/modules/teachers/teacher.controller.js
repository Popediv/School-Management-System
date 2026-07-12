const bcrypt  = require('bcryptjs');
const prisma  = require('../../config/db');
const { generateStaffId } = require('../../utils/generators');

const getAll = async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const teachers = await prisma.teacher.findMany({
      where: search ? { user: { name: { contains: search, mode: 'insensitive' } } } : {},
      include: {
        user: { select: { name: true, email: true, isActive: true } },
        assignments: { include: { subject: true, class: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ teachers, total: teachers.length });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { name: true, email: true } },
        assignments: { include: { subject: true, class: true } },
      },
    });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    res.json(teacher);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, email, password, phone, qualification } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'name, email, password required' });

    const staffId = await generateStaffId(prisma);
    const hashed  = await bcrypt.hash(password, 12);

    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email: email.toLowerCase(), password: hashed, role: 'TEACHER' },
      });
      return tx.teacher.create({
        data: { staffId, phone, qualification, userId: user.id },
        include: { user: { select: { name: true, email: true } } },
      });
    });

    res.status(201).json({ message: 'Teacher registered', staffId, teacher });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { phone, qualification } = req.body;
    const teacher = await prisma.teacher.update({
      where: { id: req.params.id },
      data:  { phone, qualification },
      include: { user: { select: { name: true, email: true } } },
    });
    res.json({ message: 'Teacher updated', teacher });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      select: { userId: true }
    });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    // Soft delete: deactivate the user account so they can no longer log in
    await prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: false }
    });

    res.json({ message: 'Teacher access revoked successfully' });
  } catch (err) { next(err); }
};


const assignSubjectClass = async (req, res, next) => {
  try {
    const { teacherId, subjectId, classId, session } = req.body;
    if (!teacherId || !subjectId || !classId || !session)
      return res.status(400).json({ message: 'teacherId, subjectId, classId, session required' });

    const assignment = await prisma.teacherSubjectClass.upsert({
      where: { teacherId_subjectId_classId_session: { teacherId, subjectId, classId, session } },
      update: {},
      create: { teacherId, subjectId, classId, session },
      include: { teacher: { include: { user: { select: { name: true } } } }, subject: true, class: true },
    });
    res.status(201).json({ message: 'Assignment created', assignment });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove, assignSubjectClass };

