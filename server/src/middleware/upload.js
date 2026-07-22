const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sms_passports',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  }
});

const cloudinaryDocStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sms_documents',
    resource_type: 'auto',
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
             allowed.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only JPEG/PNG/WEBP images are allowed'));
};

const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const cloudinaryPdfStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sms_pdfs',
    resource_type: 'auto',
  }
});

const cloudinaryLogoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sms_logos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
  }
});

// Use Cloudinary if credentials are provided, otherwise fallback to local
const storage = hasCloudinary ? cloudinaryStorage : localDiskStorage;

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

const docStorage = hasCloudinary ? cloudinaryDocStorage : localDiskStorage;

const uploadDoc = multer({
  storage: docStorage,
  fileFilter: docFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for notes documents
});

const pdfFilter = (_req, file, cb) => {
  const ok = file.mimetype === 'application/pdf' ||
             path.extname(file.originalname).toLowerCase() === '.pdf';
  ok ? cb(null, true) : cb(new Error('Only PDF files are allowed'));
};

const pdfStorage = hasCloudinary ? cloudinaryPdfStorage : localDiskStorage;

const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max per PDF
});

const logoStorage = hasCloudinary ? cloudinaryLogoStorage : localDiskStorage;

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

upload.uploadDoc = uploadDoc;
upload.uploadPdf = uploadPdf;
upload.uploadLogo = uploadLogo;

module.exports = upload;
