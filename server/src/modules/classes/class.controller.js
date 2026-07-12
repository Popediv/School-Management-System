const prisma = require('../../config/db');

const getAll = async (req, res, next) => {
  try {
    let classes;
    if (req.user && req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id }
      });
      if (student && student.currentClassId) {
        const cls = await prisma.class.findUnique({
          where: { id: student.currentClassId },
          include: { _count: { select: { students: true } } }
        });
        classes = cls ? [cls] : [];
      } else {
        classes = [];
      }
    } else if (req.user && req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: { children: { include: { currentClass: { include: { _count: { select: { students: true } } } } } } }
      });
      if (parent && parent.children) {
        const classMap = {};
        parent.children.forEach(child => {
          if (child.currentClass) {
            classMap[child.currentClass.id] = child.currentClass;
          }
        });
        classes = Object.values(classMap).sort((a, b) => a.name.localeCompare(b.name));
      } else {
        classes = [];
      }
    } else if (req.user && req.user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id }
      });
      if (teacher) {
        const assignments = await prisma.teacherSubjectClass.findMany({
          where: { teacherId: teacher.id },
          include: { class: { include: { _count: { select: { students: true } } } } }
        });
        const classMap = {};
        assignments.forEach(a => {
          classMap[a.class.id] = a.class;
        });
        classes = Object.values(classMap).sort((a, b) => a.name.localeCompare(b.name));
      } else {
        classes = [];
      }
    } else {
      classes = await prisma.class.findMany({
        include: { _count: { select: { students: true } } },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      });
    }
    res.json({ classes });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: {
        students: { include: { parent: { select: { name: true, phone: true } } } },
        assignments: { include: { teacher: { include: { user: { select: { name: true } } } }, subject: true } },
      },
    });
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    res.json(cls);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, level, arm, session } = req.body;
    if (!name || !level || !arm || !session)
      return res.status(400).json({ message: 'name, level, arm, session required' });
    const cls = await prisma.class.create({ data: { name, level, arm, session } });
    res.status(201).json({ message: 'Class created', class: cls });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { name, level, arm, session } = req.body;
    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: { name, level, arm, session },
    });
    res.json({ message: 'Class updated', class: cls });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const classId = req.params.id;
    // Check if class has students
    const studentCount = await prisma.student.count({
      where: { currentClassId: classId }
    });
    
    if (studentCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete class. There are currently ${studentCount} active students in this class.` 
      });
    }

    // Since there are no students, we can delete the class.
    // Prisma will cascade or fail on other relations (like assignments). We'll explicitly delete assignments first.
    await prisma.$transaction([
      prisma.teacherSubjectClass.deleteMany({ where: { classId } }),
      prisma.schemeOfWork.deleteMany({ where: { classId } }),
      prisma.class.delete({ where: { id: classId } })
    ]);

    res.json({ message: 'Class deleted successfully' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove };
