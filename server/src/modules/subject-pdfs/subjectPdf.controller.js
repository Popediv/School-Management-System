const prisma = require('../../config/db');
const fs = require('fs');
const path = require('path');

const PDF_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const safeUnlink = (filePath) => {
  if (!filePath || typeof filePath !== 'string' || filePath.startsWith('http')) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) { }
};

// GET /api/subject-pdfs?subjectId=&classId=&term=
const getAll = async (req, res, next) => {
  try {
    const { subjectId, classId, term } = req.query;
    const where = {};
    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (term) where.term = term;

    const pdfs = await prisma.subjectPdf.findMany({
      where,
      include: {
        subject: { select: { name: true, code: true, level: true, category: true } },
        class: { select: { name: true } },
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

// POST /api/subject-pdfs — upload a PDF for a term (or all terms)
const create = async (req, res, next) => {
  try {
    const { subjectId, classId, term, label, applyToAllTerms } = req.body;

    if (!subjectId || !classId) {
      if (req.file) safeUnlink(req.file.path);
      return res.status(400).json({ message: 'subjectId and classId are required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required' });
    }

    const selectedTerm = term || 'FIRST';
    const termsToApply = (applyToAllTerms === 'true' || applyToAllTerms === true)
      ? ['FIRST', 'SECOND', 'THIRD']
      : [selectedTerm];

    const newPdfFile = req.file.path.startsWith('http') ? req.file.path : req.file.filename;

    const results = [];
    for (const t of termsToApply) {
      const existing = await prisma.subjectPdf.findUnique({
        where: { subjectId_classId_term: { subjectId, classId, term: t } },
      });

      if (existing) {
        if (!existing.pdfFile.startsWith('http') && existing.pdfFile !== newPdfFile) {
          safeUnlink(path.join(PDF_DIR, existing.pdfFile));
        }

        const updated = await prisma.subjectPdf.update({
          where: { id: existing.id },
          data: { pdfFile: newPdfFile, label: label || null },
        });
        results.push(updated);
      } else {
        const created = await prisma.subjectPdf.create({
          data: { subjectId, classId, term: t, pdfFile: newPdfFile, label: label || null },
        });
        results.push(created);
      }
    }

    // Automatically trigger PDF Scheme Auto-Extraction in background/after upload
    let extractedCount = 0;
    try {
      const { extractAllSchemesFromPdf } = require('../../utils/pdfExtractor');

      let filePathToExtract;
      let isTempFile = false;

      if (req.file.path.startsWith('http')) {
        const tempFilename = `temp_${Date.now()}.pdf`;
        const tempDir = path.join(__dirname, '..', '..', '..', 'uploads', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        filePathToExtract = path.join(tempDir, tempFilename);

        const response = await fetch(req.file.path);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          fs.writeFileSync(filePathToExtract, Buffer.from(buffer));
          isTempFile = true;
        }
      } else {
        filePathToExtract = req.file.path;
      }

      if (filePathToExtract && fs.existsSync(filePathToExtract)) {
        const allTermSchemes = await extractAllSchemesFromPdf(filePathToExtract);
        const targetSession = 'GENERAL';

        for (const t of ['FIRST', 'SECOND', 'THIRD']) {
          const weeks = allTermSchemes[t] || [];
          for (const item of weeks) {
            await prisma.schemeOfWork.upsert({
              where: {
                subjectId_classId_term_session_week: {
                  subjectId,
                  classId,
                  term: t,
                  session: targetSession,
                  week: item.week
                }
              },
              update: {
                topic: item.topic,
                objectives: item.objectives || '',
                notesText: item.notesText || ''
              },
              create: {
                subjectId,
                classId,
                term: t,
                session: targetSession,
                week: item.week,
                topic: item.topic,
                objectives: item.objectives || '',
                notesText: item.notesText || ''
              }
            });
            extractedCount++;
          }
        }
      }

      if (isTempFile && filePathToExtract) {
        try { fs.unlinkSync(filePathToExtract); } catch (e) { }
      }
    } catch (autoErr) {
      console.error('Auto-extraction on upload notice:', autoErr.message);
    }

    res.status(201).json({
      message: extractedCount > 0
        ? `PDF uploaded and ${extractedCount} weekly topics automatically extracted into Scheme of Work!`
        : (termsToApply.length > 1 ? 'PDF applied to all terms successfully' : 'PDF uploaded successfully'),
      pdfs: results,
      pdf: results[0],
      autoExtractedCount: extractedCount
    });
  } catch (err) {
    if (req.file) {
      safeUnlink(req.file.path);
    }
    next(err);
  }
};

// POST /api/subject-pdfs/copy-to-all — Copy an existing PDF record to all terms
const copyToAllTerms = async (req, res, next) => {
  try {
    const { subjectId, classId, sourceTerm } = req.body;
    if (!subjectId || !classId) {
      return res.status(400).json({ message: 'subjectId and classId are required' });
    }

    const source = await prisma.subjectPdf.findFirst({
      where: { subjectId, classId, ...(sourceTerm ? { term: sourceTerm } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    if (!source) {
      return res.status(404).json({ message: 'No source PDF found to copy' });
    }

    const allTerms = ['FIRST', 'SECOND', 'THIRD'];
    const results = [];

    for (const t of allTerms) {
      const existing = await prisma.subjectPdf.findUnique({
        where: { subjectId_classId_term: { subjectId, classId, term: t } },
      });

      if (existing) {
        const updated = await prisma.subjectPdf.update({
          where: { id: existing.id },
          data: { pdfFile: source.pdfFile, label: source.label },
        });
        results.push(updated);
      } else {
        const created = await prisma.subjectPdf.create({
          data: { subjectId, classId, term: t, pdfFile: source.pdfFile, label: source.label },
        });
        results.push(created);
      }
    }

    res.json({ message: 'PDF copied to First, Second, and Third terms successfully', pdfs: results });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/subject-pdfs/:id
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.subjectPdf.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'PDF not found' });

    // Check if other terms are using the same file before deleting local file
    const sameFileCount = await prisma.subjectPdf.count({
      where: { pdfFile: existing.pdfFile, id: { not: id } },
    });

    if (sameFileCount === 0 && !existing.pdfFile.startsWith('http')) {
      safeUnlink(path.join(PDF_DIR, existing.pdfFile));
    }

    await prisma.subjectPdf.delete({ where: { id } });
    res.json({ message: 'PDF deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, viewPdf, create, copyToAllTerms, remove };
