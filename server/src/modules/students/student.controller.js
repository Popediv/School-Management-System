const bcrypt  = require('bcryptjs');
const prisma  = require('../../config/db');
const { generateAdmissionNo, generateMoodleUsername, generateMoodlePassword } = require('../../utils/generators');

// GET /api/students
const getAll = async (req, res, next) => {
  try {
    const { search = '', status, class: classFilter, classId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && { status }),
      ...(classFilter && { currentClass: { name: classFilter } }),
      ...(classId && { currentClassId: classId }),
      ...(search && {
        OR: [
          { firstName:   { contains: search, mode: 'insensitive' } },
          { lastName:    { contains: search, mode: 'insensitive' } },
          { admissionNo: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { currentClass: { select: { name: true } }, parent: { select: { name: true, phone: true } } },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ students, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

// GET /api/students/:id
const getById = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        currentClass: true,
        parent: true,
        user: { select: { email: true, isActive: true } },
        enrollments: { include: { class: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Parents can only view their own children
    if (req.user.role === 'PARENT' && student.parent?.userId !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    // Students can only view themselves
    if (req.user.role === 'STUDENT' && student.userId !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    res.json(student);
  } catch (err) { next(err); }
};

// POST /api/students
const create = async (req, res, next) => {
  try {
    const {
      firstName, lastName, otherNames, dateOfBirth, gender,
      stateOfOrigin, lga, religion, bloodGroup, previousSchool,
      session, classId, status,
      parentName, parentPhone, parentEmail, address, relationship,
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !gender || !session || !classId)
      return res.status(400).json({ message: 'Missing required student fields' });

    // Generate permanent identifiers
    const admissionNo      = await generateAdmissionNo(prisma);
    const moodleUsername   = generateMoodleUsername(admissionNo);
    const moodlePassword   = generateMoodlePassword(lastName, dateOfBirth);
    const defaultEmail     = `${moodleUsername}@patimo.edu`;
    const defaultPassword  = await bcrypt.hash(moodlePassword, 12);

    // Photo path (handles both local filename and Cloudinary URL)
    const photo = req.file ? (req.file.path.startsWith('http') ? req.file.path : req.file.filename) : null;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create user account for student
      const studentUser = await tx.user.create({
        data: { name: `${firstName} ${lastName}`, email: defaultEmail, password: defaultPassword, role: 'STUDENT' },
      });

      // 2. Handle parent — find existing or create
      let parentId = null;
      if (parentPhone) {
        let parentUser = await tx.user.findFirst({ where: { name: parentName, role: 'PARENT' } });
        if (!parentUser) {
          const parentEmail2 = parentEmail || `parent.${Date.now()}@patimo.edu`;
          const parentPwd    = await bcrypt.hash('Parent@123', 12);
          parentUser = await tx.user.create({
            data: { name: parentName, email: parentEmail2, password: parentPwd, role: 'PARENT' },
          });
        }

        let parent = await tx.parent.findUnique({ where: { userId: parentUser.id } });
        if (!parent) {
          parent = await tx.parent.create({
            data: { name: parentName, phone: parentPhone, email: parentEmail, address, relationship, userId: parentUser.id },
          });
        }
        parentId = parent.id;
      }

      // 3. Create student record
      const student = await tx.student.create({
        data: {
          admissionNo, moodleUsername, moodlePassword,
          firstName, lastName, otherNames,
          dateOfBirth: new Date(dateOfBirth),
          gender, photo, stateOfOrigin, lga, religion, bloodGroup,
          previousSchool, session,
          status: status || 'ACTIVE',
          userId: studentUser.id,
          parentId,
          currentClassId: classId,
        },
        include: { currentClass: true, parent: true },
      });

      // 4. Create enrollment record (class history)
      await tx.enrollment.create({
        data: { studentId: student.id, classId, session },
      });

      return student;
    });

    res.status(201).json({
      message: `Student registered successfully`,
      admissionNo: result.admissionNo,
      moodleUsername: result.moodleUsername,
      moodlePassword,
      id: result.id,
      student: result,
    });
  } catch (err) { next(err); }
};

// PUT /api/students/:id
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = [
      'firstName','lastName','otherNames','dateOfBirth','gender',
      'stateOfOrigin','lga','religion','bloodGroup','status','previousSchool',
    ];
    const data = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    if (req.body.dateOfBirth) data.dateOfBirth = new Date(req.body.dateOfBirth);
    if (req.file) data.photo = req.file.path.startsWith('http') ? req.file.path : req.file.filename;

    // NOTE: admissionNo, moodleUsername are NEVER updated here
    const student = await prisma.student.update({ where: { id }, data, include: { currentClass: true } });
    res.json({ message: 'Student updated', student });
  } catch (err) { next(err); }
};

// DELETE /api/students/:id
const remove = async (req, res, next) => {
  try {
    await prisma.student.update({
      where: { id: req.params.id },
      data:  { status: 'WITHDRAWN', user: { update: { isActive: false } } },
    });
    res.json({ message: 'Student withdrawn successfully' });
  } catch (err) { next(err); }
};

// POST /api/students/:id/promote
const promote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newClassId, session } = req.body;
    if (!newClassId || !session)
      return res.status(400).json({ message: 'newClassId and session are required' });

    const student = await prisma.$transaction(async (tx) => {
      // Update current class — admission number NEVER changes
      const updated = await tx.student.update({
        where: { id },
        data:  { currentClassId: newClassId, session },
      });

      // Add enrollment record for history
      await tx.enrollment.upsert({
        where:  { studentId_session: { studentId: id, session } },
        update: { classId: newClassId },
        create: { studentId: id, classId: newClassId, session },
      });

      return updated;
    });

    res.json({ message: 'Student promoted successfully', student });
  } catch (err) { next(err); }
};

// POST /api/students/bulk-promote
const bulkPromote = async (req, res, next) => {
  try {
    const { fromClassId, toClassId, session } = req.body;
    if (!fromClassId || !toClassId || !session)
      return res.status(400).json({ message: 'fromClassId, toClassId, and session are required' });

    const students = await prisma.student.findMany({ where: { currentClassId: fromClassId, status: 'ACTIVE' } });
    if (students.length === 0) return res.status(400).json({ message: 'No active students found in the selected class' });

    await prisma.$transaction(async (tx) => {
      if (toClassId === 'GRADUATE') {
        // Graduate students: remove currentClassId and set status
        await tx.student.updateMany({
          where: { currentClassId: fromClassId, status: 'ACTIVE' },
          data: { currentClassId: null, status: 'GRADUATED', session }
        });
      } else {
        // Normal promotion
        await tx.student.updateMany({
          where: { currentClassId: fromClassId, status: 'ACTIVE' },
          data: { currentClassId: toClassId, session }
        });

        // Add enrollment records
        const enrollments = students.map(s => ({
          studentId: s.id,
          classId: toClassId,
          session
        }));
        // Note: createMany might fail if (studentId, session) is duplicated.
        // For safe bulk upsert in Prisma, loop or do createManySkipDuplicates
        await tx.enrollment.createMany({
          data: enrollments,
          skipDuplicates: true
        });
      }
    });

    res.json({ message: toClassId === 'GRADUATE' ? 'Students graduated successfully' : 'Students promoted successfully', count: students.length });
  } catch (err) { next(err); }
};

// GET /api/students/moodle-export
const exportMoodle = async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      where: { status: 'ACTIVE' },
      include: { 
        user: { select: { email: true } },
        currentClass: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const headers = ['username', 'firstname', 'lastname', 'email', 'password', 'cohort1'];
    const rows = students.map(s => {
      // Escape fields that might contain commas
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      return [
        escape(s.moodleUsername),
        escape(s.firstName),
        escape(s.lastName),
        escape(s.user?.email),
        escape(s.moodlePassword || ''),
        escape(s.currentClass?.name || '')
      ].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="moodle_users_export.csv"');
    res.status(200).send(csvData);
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove, promote, bulkPromote, exportMoodle };
