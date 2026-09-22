const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');
const { generateAdmissionNo, generateMoodleUsername, generateMoodlePassword } = require('../../utils/generators');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// GET /api/students
const getAll = async (req, res, next) => {
  try {
    const { search = '', status, class: classFilter, classId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && status.trim() !== '' && { status: status.trim().toUpperCase() }),
      ...(classFilter && { currentClass: { name: classFilter } }),
      ...(classId && { currentClassId: classId }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { admissionNo: { contains: search, mode: 'insensitive' } },
          { currentClass: { name: { contains: search, mode: 'insensitive' } } },
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
      session, classId, status, fingerprintTemplate,
      parentName, parentPhone, parentEmail, address, relationship,
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !gender || !session || !classId)
      return res.status(400).json({ message: 'Missing required student fields' });

    // Permanent identifiers that don't depend on transaction
    const moodlePassword = generateMoodlePassword(lastName);

    // Class-based email portion
    const targetClass = await prisma.class.findUnique({ where: { id: classId } });
    const classSlug = targetClass ? targetClass.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'student';

    // Pre-compute password hashes outside transaction to prevent transaction timeout
    const defaultPassword = await bcrypt.hash(moodlePassword, 10);
    const defaultParentPwd = await bcrypt.hash('Parent@123', 10);

    // Photo path (handles both local filename and Cloudinary URL)
    const photo = req.file ? (req.file.path.startsWith('http') ? req.file.path : req.file.filename) : null;

    // Retry loop for admission number collision safety
    let result = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        result = await prisma.$transaction(async (tx) => {
          // Generate identifiers INSIDE transaction to prevent race conditions
          const admissionNo = await generateAdmissionNo(tx);
          const moodleUsername = generateMoodleUsername(admissionNo);

          // Unique email per student: classSlug + admissionNo (e.g. jss1pci20260001@gmail.com)
          const admissionSlug = admissionNo.toLowerCase().replace(/-/g, '');
          const defaultEmail = `${classSlug}${admissionSlug}@gmail.com`;

          // 1. Create user account for student
          const studentUser = await tx.user.create({
            data: { name: `${firstName} ${lastName}`, email: defaultEmail, password: defaultPassword, role: 'STUDENT' },
          });

          // 2. Handle parent — find existing by phone, or create new
          let parentId = null;
          if (parentPhone) {
            let parentRecord = await tx.parent.findFirst({ where: { phone: parentPhone } });
            if (!parentRecord) {
              const parentEmail2 = parentEmail || `parent.${Date.now()}@patimo.edu`;
              const parentUser = await tx.user.create({
                data: { name: parentName, email: parentEmail2, password: defaultParentPwd, role: 'PARENT' },
              });
              parentRecord = await tx.parent.create({
                data: { name: parentName, phone: parentPhone, email: parentEmail, address, relationship, userId: parentUser.id },
              });
            }
            parentId = parentRecord.id;
          }

          // 3. Create student record
          const student = await tx.student.create({
            data: {
              admissionNo, moodleUsername, moodlePassword,
              firstName, lastName, otherNames,
              dateOfBirth: new Date(dateOfBirth),
              gender, photo, stateOfOrigin, lga, religion, bloodGroup,
              previousSchool, session,
              fingerprintTemplate: fingerprintTemplate || null,
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
        }, { maxWait: 15000, timeout: 30000 });

        // If we get here, transaction succeeded
        break;
      } catch (innerErr) {
        if (innerErr.code === 'P2002' && attempts < 2) {
          attempts++;
          continue; // Retry
        }
        throw innerErr; // Re-throw if out of attempts or not a unique violation
      }
    }

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
      'firstName', 'lastName', 'otherNames', 'dateOfBirth', 'gender',
      'stateOfOrigin', 'lga', 'religion', 'bloodGroup', 'status', 'previousSchool',
      'fingerprintTemplate',
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
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, userId: true }
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    if (student.status === 'ACTIVE') {
      return res.status(400).json({
        message: 'Active students cannot be permanently deleted. Change student status to Withdrawn or Suspended first.'
      });
    }

    if (student.status === 'GRADUATED') {
      return res.status(400).json({
        message: 'Graduated student records cannot be deleted as they are preserved for alumni & academic reference.'
      });
    }

    // Permanently delete student and all linked records
    await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({ where: { studentId: student.id } });
      await tx.result.deleteMany({ where: { studentId: student.id } });
      await tx.payment.deleteMany({ where: { studentId: student.id } });
      await tx.enrollment.deleteMany({ where: { studentId: student.id } });
      await tx.student.delete({ where: { id: student.id } });
      if (student.userId) {
        await tx.user.delete({ where: { id: student.userId } });
      }
    });

    res.json({ message: 'Student record permanently deleted successfully' });
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
      const existingStudent = await tx.student.findUnique({ where: { id }, select: { admissionNo: true } });
      const targetClass = await tx.class.findUnique({ where: { id: newClassId } });
      const classSlug = targetClass ? targetClass.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'student';
      const admissionSlug = existingStudent.admissionNo.toLowerCase().replace(/-/g, '');
      const newEmail = `${classSlug}${admissionSlug}@gmail.com`;
      // Update current class and update student user email to match new class
      const updated = await tx.student.update({
        where: { id },
        data: {
          currentClassId: newClassId,
          session,
          user: { update: { email: newEmail } }
        },
      });

      // Add enrollment record for history
      await tx.enrollment.upsert({
        where: { studentId_session: { studentId: id, session } },
        update: { classId: newClassId },
        create: { studentId: id, classId: newClassId, session },
      });

      return updated;
    }, { maxWait: 10000, timeout: 15000 });

    res.json({ message: 'Student promoted successfully', student });
  } catch (err) { next(err); }
};

// POST /api/students/bulk-promote
const bulkPromote = async (req, res, next) => {
  try {
    const { fromClassId, toClassId, session, fromSession } = req.body;
    if (!fromClassId || !toClassId || !session)
      return res.status(400).json({ message: 'fromClassId, toClassId, and session are required' });

    const studentWhere = {
      currentClassId: fromClassId,
      status: 'ACTIVE',
      ...(fromSession && { session: fromSession })
    };

    const students = await prisma.student.findMany({ where: studentWhere });
    if (students.length === 0) return res.status(400).json({ message: 'No active students found matching the selected class and session filter' });

    await prisma.$transaction(async (tx) => {
      if (toClassId === 'GRADUATE') {
        // Graduate students: remove currentClassId and set status
        await tx.student.updateMany({
          where: studentWhere,
          data: { currentClassId: null, status: 'GRADUATED', session }
        });
        const userIds = students.map(s => s.userId).filter(Boolean);
        if (userIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: userIds } },
            data: { email: 'graduated@gmail.com' }
          });
        }
      } else {
        // Normal promotion
        const targetClass = await tx.class.findUnique({ where: { id: toClassId } });
        const classSlug = targetClass ? targetClass.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'student';

        await tx.student.updateMany({
          where: studentWhere,
          data: { currentClassId: toClassId, session }
        });

        // Update each student's email individually (unique per student)
        for (const s of students) {
          if (s.userId) {
            const admissionSlug = s.admissionNo.toLowerCase().replace(/-/g, '');
            const newEmail = `${classSlug}${admissionSlug}@gmail.com`;
            await tx.user.update({
              where: { id: s.userId },
              data: { email: newEmail }
            });
          }
        }

        // Add enrollment records
        const enrollments = students.map(s => ({
          studentId: s.id,
          classId: toClassId,
          session
        }));
        await tx.enrollment.createMany({
          data: enrollments,
          skipDuplicates: true
        });
      }
    }, { maxWait: 10000, timeout: 15000 });

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
      const classSlug = s.currentClass?.name ? s.currentClass.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'student';
      const email = `${classSlug}@gmail.com`;
      return [
        escape(s.moodleUsername),
        escape(s.firstName),
        escape(s.lastName),
        escape(email),
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

// GET /api/students/moodle-import
const exportCustomMoodle = async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { email: true } },
        currentClass: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const headers = ['username', 'firstname', 'lastname', 'email', 'password'];
    const rows = students.map(s => {
      // Escape fields that might contain commas
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      const classSlug = s.currentClass?.name ? s.currentClass.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'student';
      const email = `${classSlug}@gmail.com`;
      return [
        escape(s.moodleUsername),
        escape(s.firstName),
        escape(s.lastName),
        escape(email),
        escape(s.moodlePassword || s.lastName.trim().toLowerCase()),
      ].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="moodle_users_import.csv"');
    res.status(200).send(csvData);
  } catch (err) { next(err); }
};

// GET /api/students/pictures-zip
const exportPicturesZip = async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      where: { status: 'ACTIVE', photo: { not: null } }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="student_pictures.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    archive.on('error', (err) => {
      throw err;
    });

    for (const student of students) {
      if (!student.photo.startsWith('http')) {
        const photoFilename = path.basename(student.photo);
        const photoPath = path.join(__dirname, '..', '..', '..', '..', 'uploads', photoFilename);
        if (fs.existsSync(photoPath)) {
          const ext = path.extname(photoFilename) || '.jpg';
          const filename = `${student.admissionNo}${ext}`;
          archive.append(fs.createReadStream(photoPath), { name: filename });
        }
      }
    }

    archive.finalize();
  } catch (err) { next(err); }
};

// POST /api/students/bulk-delete
const bulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No student IDs provided for bulk deletion' });
    }

    const students = await prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, firstName: true, lastName: true, userId: true }
    });

    if (students.length === 0) {
      return res.status(404).json({ message: 'No matching student records found' });
    }

    // Safety filter: Only WITHDRAWN and SUSPENDED students are deletable
    const deletable = students.filter(s => s.status === 'WITHDRAWN' || s.status === 'SUSPENDED');
    const blocked = students.filter(s => s.status === 'ACTIVE' || s.status === 'GRADUATED');

    if (deletable.length === 0) {
      return res.status(400).json({
        message: 'None of the selected students can be deleted. Active and Graduated student records are protected.'
      });
    }

    const deletableIds = deletable.map(s => s.id);
    const deletableUserIds = deletable.map(s => s.userId).filter(Boolean);

    await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({ where: { studentId: { in: deletableIds } } });
      await tx.result.deleteMany({ where: { studentId: { in: deletableIds } } });
      await tx.payment.deleteMany({ where: { studentId: { in: deletableIds } } });
      await tx.enrollment.deleteMany({ where: { studentId: { in: deletableIds } } });
      await tx.student.deleteMany({ where: { id: { in: deletableIds } } });
      if (deletableUserIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: deletableUserIds } } });
      }
    }, { maxWait: 10000, timeout: 15000 });

    let message = `Successfully deleted ${deletable.length} non-active student record(s).`;
    if (blocked.length > 0) {
      message += ` (${blocked.length} Active/Graduated student(s) were skipped as protected records).`;
    }

    res.json({ message, deletedCount: deletable.length, skippedCount: blocked.length });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove, promote, bulkPromote, bulkDelete, exportMoodle, exportCustomMoodle, exportPicturesZip };
