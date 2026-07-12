const prisma = require('../../config/db');

const getAll = async (req, res, next) => {
  try {
    let subjects;
    if (req.user && req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id }
      });
      if (teacher) {
        const assignments = await prisma.teacherSubjectClass.findMany({
          where: { teacherId: teacher.id },
          include: { subject: true }
        });
        const subjectMap = {};
        assignments.forEach(a => {
          subjectMap[a.subject.id] = a.subject;
        });
        subjects = Object.values(subjectMap).sort((a, b) => a.name.localeCompare(b.name));
      } else {
        subjects = [];
      }
    } else {
      subjects = await prisma.subject.findMany({ orderBy: [{ level: 'asc' }, { category: 'asc' }, { name: 'asc' }] });
    }
    res.json({ subjects });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, code, level, category } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'name and code are required' });
    const subject = await prisma.subject.create({
      data: { name, code: code.toUpperCase(), level: level || null, category: category || null }
    });
    res.status(201).json({ message: 'Subject created', subject });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data:  req.body,
    });
    res.json({ message: 'Subject updated', subject });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.subject.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Subject not found' });

    await prisma.subject.delete({ where: { id } });
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, remove };
