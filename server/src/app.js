const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// ─── Security middleware ────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000', 'https://patimo-sms.vercel.app'], credentials: true }));

// ─── Rate limiting (login endpoint) ────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { message: 'Too many login attempts. Please try again later.' },
});

// ─── Body parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Static file serving (passport photos, documents) ──────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── API Routes ────────────────────────────────────────────
app.use('/api/auth', loginLimiter, require('./modules/auth/auth.routes'));
app.use('/api/students', require('./modules/students/student.routes'));
app.use('/api/teachers', require('./modules/teachers/teacher.routes'));
app.use('/api/classes', require('./modules/classes/class.routes'));
app.use('/api/subjects', require('./modules/subjects/subject.routes'));
app.use('/api/attendance', require('./modules/attendance/attendance.routes'));
app.use('/api/results', require('./modules/results/result.routes'));
app.use('/api/fees', require('./modules/fees/fee.routes'));
app.use('/api/idcards', require('./modules/idcards/idcard.routes'));
app.use('/api/notifications', require('./modules/notifications/notification.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/schemes', require('./modules/schemes/scheme.routes'));
app.use('/api/settings', require('./modules/settings/settings.routes'));
app.use('/api/subject-pdfs', require('./modules/subject-pdfs/subjectPdf.routes'));


// ─── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'SMS API' });
});

// ─── 404 handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// ─── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'A record with that value already exists' });
  }
  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error',
  });
});

// ─── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`SMS Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`School: ${process.env.SCHOOL_NAME}\n`);
});

module.exports = app;
// Trigger nodemon restart
