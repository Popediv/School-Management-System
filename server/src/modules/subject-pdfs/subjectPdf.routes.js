const express = require('express');
const router  = express.Router();
const ctrl    = require('./subjectPdf.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const PDF_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PDF_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const pdfFilter = (_req, file, cb) => {
  const ok = file.mimetype === 'application/pdf' ||
             path.extname(file.originalname).toLowerCase() === '.pdf';
  ok ? cb(null, true) : cb(new Error('Only PDF files are allowed'));
};

const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max per PDF
});

const ADMINS = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);

// Teachers and admins can list and view
router.get('/',        ctrl.getAll);
router.get('/:id/view', ctrl.viewPdf);

// Only admins can upload/delete
router.post('/',    allowRoles(...ADMINS), uploadPdf.single('pdfFile'), ctrl.create);
router.delete('/:id', allowRoles(...ADMINS), ctrl.remove);

module.exports = router;
