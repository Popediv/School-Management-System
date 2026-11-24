const path = require('path');
const fs = require('fs');

const PSYCHOMOTOR_FILE = path.join(__dirname, '..', '..', '..', 'data', 'psychomotor.json');

function readPsychomotor() {
  try {
    if (fs.existsSync(PSYCHOMOTOR_FILE)) {
      return JSON.parse(fs.readFileSync(PSYCHOMOTOR_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading psychomotor data:', err.message);
  }
  return {};
}

function writePsychomotor(data) {
  try {
    const dir = path.dirname(PSYCHOMOTOR_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PSYCHOMOTOR_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing psychomotor data:', err.message);
  }
}

function getStudentPsychomotor(studentId, session, term) {
  const data = readPsychomotor();
  const key = `${studentId}_${session}_${term}`;
  return data[key]?.traits || null;
}

module.exports = { readPsychomotor, writePsychomotor, getStudentPsychomotor };
