/**
 * moodle.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Loads / saves the Moodle integration config from:
 *   server/src/config/moodle_config.json
 *
 * Schema of the JSON file:
 * {
 *   "moodleUrl":       "https://your-moodle.com",
 *   "moodleToken":     "your_webservice_token",
 *   "idField":         "username",          // Moodle user field that holds admissionNo
 *   "courseMap": [                           // one entry per Moodle course
 *     {
 *       "courseId":    4,                   // Moodle internal course ID
 *       "subjectCode": "MTH",              // must match Subject.code in your SMS DB
 *       "caGradeItemName":   "CA",         // partial name of the CA grade item in Moodle
 *       "examGradeItemName": "EXAM"        // partial name of the Exam grade item
 *     }
 *   ]
 * }
 */

const fs   = require('fs');
const path = require('path');

const CONFIG_PATH     = path.join(__dirname, '..', '..', '..', 'data', 'moodle_config.json');
const OLD_CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'moodle_config.json');

/** Returns the current config object (or empty defaults) */
function getMoodleConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
    // Backward-compat: migrate from old path inside src/config
    if (fs.existsSync(OLD_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(OLD_CONFIG_PATH, 'utf8'));
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
      return data;
    }
  } catch (_) { /* ignore parse errors */ }

  return {
    moodleUrl:   '',
    moodleToken: '',
    idField:     'username',
    courseMap:   [],
  };
}

/** Merges and persists new values into the config file */
function saveMoodleConfig(incoming) {
  const existing = getMoodleConfig();
  const updated  = { ...existing, ...incoming };
  const dir      = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

module.exports = { getMoodleConfig, saveMoodleConfig };
