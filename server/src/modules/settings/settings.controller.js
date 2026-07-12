const fs = require('fs');
const path = require('path');

const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No logo file uploaded' });
    }

    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, '..', '..', '..', 'uploads', 'school_logo.png');

    fs.copyFileSync(tempPath, targetPath);
    try { fs.unlinkSync(tempPath); } catch (e) {}

    res.json({ message: 'School logo uploaded successfully', logoUrl: '/uploads/school_logo.png' });
  } catch (err) { next(err); }
};

const getSettings = async (req, res, next) => {
  try {
    const hasLogo = fs.existsSync(path.join(__dirname, '..', '..', '..', 'uploads', 'school_logo.png'));
    res.json({
      schoolName: process.env.SCHOOL_NAME || 'Patimo College',
      logoUrl: hasLogo ? '/uploads/school_logo.png' : null
    });
  } catch (err) { next(err); }
};

module.exports = { uploadLogo, getSettings };
