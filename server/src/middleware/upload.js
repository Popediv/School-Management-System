const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
             allowed.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only JPEG/PNG/WEBP images are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

const docFileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|pdf|doc|docx|txt/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) ||
             file.mimetype.includes('pdf') ||
             file.mimetype.includes('msword') ||
             file.mimetype.includes('officedocument') ||
             file.mimetype.startsWith('image/');
  ok ? cb(null, true) : cb(new Error('Only images, PDFs, and Word/text documents are allowed'));
};

const uploadDoc = multer({
  storage,
  fileFilter: docFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for notes documents
});

upload.uploadDoc = uploadDoc;

module.exports = upload;
