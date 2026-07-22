const prisma = require('../../config/db');
const fs = require('fs');
const path = require('path');

const safeUnlink = (filePath) => {
  if (!filePath || typeof filePath !== 'string' || filePath.startsWith('http')) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
};

// GET /api/schemes
const getAll = async (req, res, next) => {
  try {
    const { subjectId, classId, term, session } = req.query;

    const where = {};
    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (term) where.term = term;
    if (session) where.session = session;

    // Check if the current user has student or parent roles to restrict notes access
    const isRestricted = req.user.role === 'STUDENT' || req.user.role === 'PARENT';

    const select = {
      id: true,
      subjectId: true,
      classId: true,
      term: true,
      session: true,
      week: true,
      topic: true,
      objectives: true,
      createdAt: true,
      updatedAt: true,
      subject: {
        select: {
          name: true,
          code: true,
        },
      },
      class: {
        select: {
          name: true,
        },
      },
    };

    // Only include notes text and file path for admin/teachers
    if (!isRestricted) {
      select.notesText = true;
      select.notesFile = true;
    }

    const schemes = await prisma.schemeOfWork.findMany({
      where,
      select,
      orderBy: { week: 'asc' },
    });

    res.json({ schemes });
  } catch (err) {
    next(err);
  }
};

// GET /api/schemes/:id
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isRestricted = req.user.role === 'STUDENT' || req.user.role === 'PARENT';

    const select = {
      id: true,
      subjectId: true,
      classId: true,
      term: true,
      session: true,
      week: true,
      topic: true,
      objectives: true,
      createdAt: true,
      updatedAt: true,
      subject: {
        select: {
          name: true,
          code: true,
        },
      },
      class: {
        select: {
          name: true,
        },
      },
    };

    if (!isRestricted) {
      select.notesText = true;
      select.notesFile = true;
    }

    const scheme = await prisma.schemeOfWork.findUnique({
      where: { id },
      select,
    });

    if (!scheme) {
      return res.status(404).json({ message: 'Scheme of work entry not found' });
    }

    res.json(scheme);
  } catch (err) {
    next(err);
  }
};

// POST /api/schemes
const create = async (req, res, next) => {
  try {
    const { subjectId, classId, term, session, week, topic, objectives, notesText } = req.body;

    if (!subjectId || !classId || !term || !session || !week || !topic) {
      // Clean up uploaded file if validation fails
      if (req.file) safeUnlink(req.file.path);
      return res.status(400).json({ message: 'subjectId, classId, term, session, week, and topic are required' });
    }

    const weekNum = parseInt(week);
    if (isNaN(weekNum)) {
      if (req.file) safeUnlink(req.file.path);
      return res.status(400).json({ message: 'week must be an integer' });
    }

    const notesFile = req.file ? (req.file.path.startsWith('http') ? req.file.path : req.file.filename) : null;

    // Check if duplicate week exists
    const duplicate = await prisma.schemeOfWork.findUnique({
      where: {
        subjectId_classId_term_session_week: {
          subjectId,
          classId,
          term,
          session,
          week: weekNum,
        },
      },
    });

    if (duplicate) {
      if (req.file) safeUnlink(req.file.path);
      return res.status(409).json({ message: `Scheme of work for week ${weekNum} already exists` });
    }

    const scheme = await prisma.schemeOfWork.create({
      data: {
        subjectId,
        classId,
        term,
        session,
        week: weekNum,
        topic,
        objectives,
        notesText,
        notesFile,
      },
    });

    res.status(201).json({ message: 'Scheme of work created successfully', scheme });
  } catch (err) {
    if (req.file) safeUnlink(req.file.path);
    next(err);
  }
};

// PUT /api/schemes/:id
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { topic, objectives, notesText, week, term, session, subjectId, classId } = req.body;

    const existing = await prisma.schemeOfWork.findUnique({ where: { id } });
    if (!existing) {
      if (req.file) safeUnlink(req.file.path);
      return res.status(404).json({ message: 'Scheme of work entry not found' });
    }

    const data = {};
    if (topic !== undefined) data.topic = topic;
    if (objectives !== undefined) data.objectives = objectives;
    if (notesText !== undefined) data.notesText = notesText;
    if (term !== undefined) data.term = term;
    if (session !== undefined) data.session = session;
    if (subjectId !== undefined) data.subjectId = subjectId;
    if (classId !== undefined) data.classId = classId;

    if (week !== undefined || classId !== undefined || subjectId !== undefined || term !== undefined || session !== undefined) {
      const weekNum = week !== undefined ? parseInt(week) : existing.week;
      if (isNaN(weekNum)) {
        if (req.file) safeUnlink(req.file.path);
        return res.status(400).json({ message: 'week must be an integer' });
      }
      data.week = weekNum;

      // Check unique constraint violation
      const checkSubject = subjectId || existing.subjectId;
      const checkClass = classId || existing.classId;
      const checkTerm = term || existing.term;
      const checkSession = session || existing.session;

      const duplicate = await prisma.schemeOfWork.findFirst({
        where: {
          id: { not: id },
          subjectId: checkSubject,
          classId: checkClass,
          term: checkTerm,
          session: checkSession,
          week: weekNum,
        },
      });

      if (duplicate) {
        if (req.file) safeUnlink(req.file.path);
        return res.status(409).json({ message: `Scheme of work for week ${weekNum} already exists` });
      }
    }

    if (req.file) {
      data.notesFile = req.file.path.startsWith('http') ? req.file.path : req.file.filename;

      // Clean up old file (if it was local)
      if (existing.notesFile && !existing.notesFile.startsWith('http')) {
        safeUnlink(path.join(__dirname, '..', '..', '..', 'uploads', existing.notesFile));
      }
    }

    const updated = await prisma.schemeOfWork.update({
      where: { id },
      data,
    });

    res.json({ message: 'Scheme of work entry updated successfully', scheme: updated });
  } catch (err) {
    if (req.file) safeUnlink(req.file.path);
    next(err);
  }
};

// DELETE /api/schemes/:id
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.schemeOfWork.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Scheme of work entry not found' });
    }

    // Clean up file from filesystem (if it was local)
    if (existing.notesFile && !existing.notesFile.startsWith('http')) {
      safeUnlink(path.join(__dirname, '..', '..', '..', 'uploads', existing.notesFile));
    }

    await prisma.schemeOfWork.delete({ where: { id } });
    res.json({ message: 'Scheme of work entry deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/schemes/extract-pdf
const extractFromPdf = async (req, res, next) => {
  try {
    const { subjectId, classId, term, session } = req.body;

    if (!subjectId || !classId || !term || !session) {
      return res.status(400).json({ message: 'subjectId, classId, term, and session are required' });
    }

    const { extractSchemeFromPdf } = require('../../utils/pdfExtractor');

    // Try finding term-specific PDF, fall back to any PDF for subject+class
    let pdf = await prisma.subjectPdf.findUnique({
      where: { subjectId_classId_term: { subjectId, classId, term } }
    });

    if (!pdf) {
      pdf = await prisma.subjectPdf.findFirst({
        where: { subjectId, classId }
      });
    }

    if (!pdf) {
      return res.status(404).json({ message: 'No Class Notes PDF found for this subject and class.' });
    }

    let filePath;
    let isTempFile = false;

    if (pdf.pdfFile.startsWith('http')) {
      const tempFilename = `temp_${Date.now()}_${pdf.id}.pdf`;
      const tempDir = path.join(__dirname, '..', '..', '..', 'uploads', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      filePath = path.join(tempDir, tempFilename);
      
      const response = await fetch(pdf.pdfFile);
      if (!response.ok) {
        throw new Error(`Failed to download PDF from Cloudinary: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
      isTempFile = true;
    } else {
      filePath = path.join(__dirname, '..', '..', '..', 'uploads', 'pdfs', pdf.pdfFile);
    }

    const extractedWeeks = await extractSchemeFromPdf(filePath, term);

    if (isTempFile) {
      safeUnlink(filePath);
    }

    if (!extractedWeeks || extractedWeeks.length === 0) {
      return res.status(422).json({
        message: 'No weekly scheme structure could be extracted from this PDF text. Please ensure the PDF contains topics preceded by "Week 1", "Week 2", etc.'
      });
    }

    // Upsert extracted weeks
    const createdOrUpdated = [];
    for (const item of extractedWeeks) {
      const data = {
        subjectId,
        classId,
        term,
        session,
        week: item.week,
        topic: item.topic,
        objectives: item.objectives || '',
        notesText: item.notesText || ''
      };

      const record = await prisma.schemeOfWork.upsert({
        where: {
          subjectId_classId_term_session_week: {
            subjectId,
            classId,
            term,
            session,
            week: item.week
          }
        },
        update: {
          topic: item.topic,
          objectives: item.objectives || '',
          notesText: item.notesText || ''
        },
        create: data
      });
      createdOrUpdated.push(record);
    }

    res.json({
      message: `Successfully extracted and loaded ${createdOrUpdated.length} weeks into the Scheme of Work!`,
      weeks: createdOrUpdated
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  extractFromPdf,
};
