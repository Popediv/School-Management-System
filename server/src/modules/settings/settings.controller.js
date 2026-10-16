const fs = require('fs');
const path = require('path');
const prisma = require('../../config/db');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'config', 'settings.json');

const getStoredSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
};

const saveSettings = (data) => {
  try {
    const existing = getStoredSettings();
    const updated = { ...existing, ...data };
    const configDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return updated;
  } catch (e) { }
};

const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No logo file uploaded' });
    }

    const logoUrl = req.file.path.startsWith('http')
      ? req.file.path
      : `/uploads/${req.file.filename}`;

    // Also keep local fallback copy if local file system storage was used
    if (!req.file.path.startsWith('http')) {
      try {
        const targetPath = path.join(__dirname, '..', '..', '..', 'uploads', 'school_logo.png');
        fs.copyFileSync(req.file.path, targetPath);
      } catch (e) { }
    }

    saveSettings({ logoUrl });

    res.json({ message: 'School logo uploaded successfully', logoUrl });
  } catch (err) { next(err); }
};

const uploadSignature = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No signature file uploaded' });
    }

    const signatureUrl = req.file.path.startsWith('http')
      ? req.file.path
      : `/uploads/${req.file.filename}`;

    if (!req.file.path.startsWith('http')) {
      try {
        const targetPath = path.join(__dirname, '..', '..', '..', 'uploads', 'principal_signature.png');
        fs.copyFileSync(req.file.path, targetPath);
      } catch (e) { }
    }

    saveSettings({ signatureUrl });

    res.json({ message: 'Principal signature uploaded successfully', signatureUrl });
  } catch (err) { next(err); }
};

const getSettings = async (req, res, next) => {
  try {
    const stored = getStoredSettings();
    const hasLocalLogo = fs.existsSync(path.join(__dirname, '..', '..', '..', 'uploads', 'school_logo.png'));
    const logoUrl = stored.logoUrl || (hasLocalLogo ? '/uploads/school_logo.png' : null);
    const hasLocalSig = fs.existsSync(path.join(__dirname, '..', '..', '..', 'uploads', 'principal_signature.png'));
    const signatureUrl = stored.signatureUrl || (hasLocalSig ? '/uploads/principal_signature.png' : null);

    res.json({
      schoolName: process.env.SCHOOL_NAME || 'Patimo College',
      logoUrl,
      signatureUrl,
      admissionPrefix: stored.admissionPrefix || 'PCI-' + new Date().getFullYear() + '-',
      admissionStartingSequence: stored.admissionStartingSequence || 1,
      currentSession: stored.currentSession || '2026/2027',
      currentTerm: stored.currentTerm || 'FIRST',
      resultsReleased: stored.resultsReleased ?? false,
    });
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const data = req.body;
    const updated = saveSettings(data);

    if (data.resultsReleased !== undefined) {
      const session = data.currentSession || updated.currentSession || '2026/2027';
      const term = data.currentTerm || updated.currentTerm || 'FIRST';
      try {
        await prisma.result.updateMany({
          where: { session, term },
          data: { published: Boolean(data.resultsReleased) },
        });
      } catch (err) {
        console.error('Failed to update result published flags in DB:', err.message);
      }
    }

    res.json({ message: 'Settings updated successfully', settings: getStoredSettings() });
  } catch (err) { next(err); }
};

module.exports = { uploadLogo, uploadSignature, getSettings, updateSettings, getStoredSettings };
