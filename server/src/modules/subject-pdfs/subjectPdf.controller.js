const prisma = require('../../config/db');
const fs = require('fs');
const path = require('path');

const PDF_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

// GET /api/subject-pdfs?subjectId=&classId=
const getAll = async (req, res, next) => {
  try {
    const { subjectId, classId } = req.query;
    const where = {};
    if (subjectId) where.subjectId = subjectId;
    if (classId)   where.classId = classId;

    const pdfs = await prisma.subjectPdf.findMany({
      where,
      include: {
        subject: { select: { name: true, code: true, level: true, category: true } },
        class:   { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ pdfs });
  } catch (err) {
    next(err);
  }
};

// GET /api/subject-pdfs/:id/view — streams PDF inline (no download)
const viewPdf = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Students and parents cannot view
    if (req.user.role === 'STUDENT' || req.user.role === 'PARENT') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pdf = await prisma.subjectPdf.findUnique({ where: { id } });
    if (!pdf) return res.status(404).json({ message: 'PDF not found' });

    // If the PDF is stored on Cloudinary, redirect to its secure URL
    if (pdf.pdfFile.startsWith('http')) {
      return res.redirect(pdf.pdfFile);
    }

    const filePath = path.join(PDF_DIR, pdf.pdfFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF file missing from storage' });
    }

    // Stream inline — block download via headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

const safeUnlink = (filePath) => {
  if (!filePath || typeof filePath !== 'string' || filePath.startsWith('http')) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
};

// POST /api/subject-pdfs — upload a PDF (one per subject+class)
const create = async (req, res, next) => {
  try {
    const { subjectId, classId, label } = req.body;

    if (!subjectId || !classId) {
      if (req.file) safeUnlink(req.file.path);
      return res.status(400).json({ message: 'subjectId and classId are required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required' });
    }

    // Check for existing entry (one PDF per subject+class) and replace
    const existing = await prisma.subjectPdf.findUnique({
      where: { subjectId_classId: { subjectId, classId } },
    });

    const newPdfFile = req.file.path.startsWith('http') ? req.file.path : req.file.filename;

    if (existing) {
      // Delete old file if local
      if (!existing.pdfFile.startsWith('http')) {
        safeUnlink(path.join(PDF_DIR, existing.pdfFile));
      }

      const updated = await prisma.subjectPdf.update({
        where: { id: existing.id },
        data: { pdfFile: newPdfFile, label: label || null },
      });
      return res.json({ message: 'PDF replaced successfully', pdf: updated });
    }

    const pdf = await prisma.subjectPdf.create({
      data: { subjectId, classId, pdfFile: newPdfFile, label: label || null },
    });

    res.status(201).json({ message: 'PDF uploaded successfully', pdf });
  } catch (err) {
    if (req.file) {
      safeUnlink(req.file.path);
    }
    next(err);
  }
};

// DELETE /api/subject-pdfs/:id
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.subjectPdf.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'PDF not found' });

    if (!existing.pdfFile.startsWith('http')) {
      safeUnlink(path.join(PDF_DIR, existing.pdfFile));
    }

    await prisma.subjectPdf.delete({ where: { id } });
    res.json({ message: 'PDF deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, viewPdf, create, remove };
