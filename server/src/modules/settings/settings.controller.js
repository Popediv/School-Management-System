const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'config', 'settings.json');

const getStoredSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {}
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
  } catch (e) {}
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
      } catch (e) {}
    }

    saveSettings({ logoUrl });

    res.json({ message: 'School logo uploaded successfully', logoUrl });
  } catch (err) { next(err); }
};

const getSettings = async (req, res, next) => {
  try {
    const stored = getStoredSettings();
    const hasLocalLogo = fs.existsSync(path.join(__dirname, '..', '..', '..', 'uploads', 'school_logo.png'));
    const logoUrl = stored.logoUrl || (hasLocalLogo ? '/uploads/school_logo.png' : null);

    res.json({
      schoolName: process.env.SCHOOL_NAME || 'Patimo College',
      logoUrl
    });
  } catch (err) { next(err); }
};

module.exports = { uploadLogo, getSettings };
