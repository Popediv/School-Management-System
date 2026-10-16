/**
 * moodle.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all HTTP requests for the Moodle integration endpoints.
 *
 * Routes (see moodle.routes.js):
 *   GET    /api/moodle-sync/config          → get current config (token masked)
 *   POST   /api/moodle-sync/config          → save config
 *   POST   /api/moodle-sync/test            → test Moodle connection
 *   POST   /api/moodle-sync/run             → run a full sync
 *   GET    /api/moodle-sync/logs            → list last N sync logs
 */

const path   = require('path');
const fs     = require('fs');
const { getMoodleConfig, saveMoodleConfig } = require('./moodle.config');
const { runSync } = require('./moodle.engine');

// ── Sync log helpers ─────────────────────────────────────────────────────────

const LOG_PATH = path.join(__dirname, '..', '..', '..', 'data', 'moodle_sync_logs.json');

function readLogs() {
  try {
    if (fs.existsSync(LOG_PATH)) return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch (_) {}
  return [];
}

function appendLog(entry) {
  const logs = readLogs();
  logs.unshift(entry);                     // newest first
  const trimmed = logs.slice(0, 50);       // keep last 50 runs
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(trimmed, null, 2));
}

// ── GET /api/moodle-sync/config ──────────────────────────────────────────────
const getConfig = async (req, res, next) => {
  try {
    const cfg = getMoodleConfig();
    // Mask the token for security — only show last 4 chars
    const maskedToken = cfg.moodleToken
      ? '•'.repeat(Math.max(0, cfg.moodleToken.length - 4)) + cfg.moodleToken.slice(-4)
      : '';
    res.json({ ...cfg, moodleToken: maskedToken });
  } catch (err) { next(err); }
};

// ── POST /api/moodle-sync/config ─────────────────────────────────────────────
const saveConfig = async (req, res, next) => {
  try {
    const { moodleUrl, moodleToken, idField, courseMap } = req.body;

    // Basic validation
    if (!moodleUrl) return res.status(400).json({ message: 'moodleUrl is required' });

    let cleanUrl = moodleUrl.trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }

    const existing = getMoodleConfig();

    // If token is all bullets (masked, unchanged), keep the existing one
    const tokenToSave = (moodleToken && !moodleToken.match(/^•+/))
      ? moodleToken
      : existing.moodleToken;

    const updated = saveMoodleConfig({
      moodleUrl:   cleanUrl,
      moodleToken: tokenToSave,
      idField:     idField   || 'username',
      courseMap:   Array.isArray(courseMap) ? courseMap : existing.courseMap,
    });

    res.json({ message: 'Moodle config saved', config: { ...updated, moodleToken: '••••' + (tokenToSave || '').slice(-4) } });
  } catch (err) { next(err); }
};

// ── POST /api/moodle-sync/test ───────────────────────────────────────────────
// Verifies Moodle URL + token by calling core_webservice_get_site_info
const testConnection = async (req, res, next) => {
  try {
    const cfg = getMoodleConfig();
    if (!cfg.moodleUrl || !cfg.moodleToken) {
      return res.status(400).json({ message: 'Moodle URL and token are not configured yet' });
    }

    let base = cfg.moodleUrl.trim().replace(/\/$/, '');
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = `http://${base}`;
    }

    const https = require('https');
    const http  = require('http');
    const qs    = new URLSearchParams({
      wstoken:            cfg.moodleToken,
      moodlewsrestformat: 'json',
      wsfunction:         'core_webservice_get_site_info',
    });
    const url = `${base}/webservice/rest/server.php?${qs.toString()}`;

    const lib = url.startsWith('https') ? https : http;
    let body = '';
    let statusCode = 200;

    await new Promise((resolve, reject) => {
      const request = lib.get(url, (r) => {
        statusCode = r.statusCode;
        r.on('data', (c) => { body += c; });
        r.on('end', resolve);
      });
      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy(new Error('Connection to Moodle timed out after 10s'));
      });
    });

    if (statusCode >= 400) {
      return res.status(400).json({ message: `Moodle returned HTTP status ${statusCode}` });
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({
        message: 'Moodle returned an invalid response. Ensure "Web Services" and "REST protocol" are enabled in Moodle.',
      });
    }

    if (data.exception) {
      return res.status(400).json({ message: `Moodle error: ${data.message}` });
    }

    res.json({
      message:     'Connection successful ✅',
      siteName:    data.sitename || 'Moodle',
      siteVersion: data.release  || 'Unknown',
      username:    data.username || 'Admin',
    });
  } catch (err) { next(err); }
};

// ── GET /api/moodle-sync/courses ─────────────────────────────────────────────
// Fetches all courses with their IDs from Moodle via core_course_get_courses
const getCourses = async (req, res, next) => {
  try {
    const cfg = getMoodleConfig();
    if (!cfg.moodleUrl || !cfg.moodleToken) {
      return res.status(400).json({ message: 'Moodle URL and token are not configured yet' });
    }

    let base = cfg.moodleUrl.trim().replace(/\/$/, '');
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = `http://${base}`;
    }

    const https = require('https');
    const http  = require('http');
    const qs    = new URLSearchParams({
      wstoken:            cfg.moodleToken,
      moodlewsrestformat: 'json',
      wsfunction:         'core_course_get_courses',
    });
    const url = `${base}/webservice/rest/server.php?${qs.toString()}`;

    const lib = url.startsWith('https') ? https : http;
    let body = '';
    let statusCode = 200;

    await new Promise((resolve, reject) => {
      const request = lib.get(url, (r) => {
        statusCode = r.statusCode;
        r.on('data', (c) => { body += c; });
        r.on('end', resolve);
      });
      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy(new Error('Connection to Moodle timed out after 10s'));
      });
    });

    if (statusCode >= 400) {
      return res.status(400).json({ message: `Moodle returned HTTP status ${statusCode}` });
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ message: 'Moodle returned an invalid response' });
    }

    if (data.exception) {
      return res.status(400).json({
        message: `Moodle error: ${data.message}. Make sure "core_course_get_courses" is added to your External Service in Moodle.`,
      });
    }

    // Filter out site home (id: 1)
    const courses = (Array.isArray(data) ? data : [])
      .filter(c => c.id > 1)
      .map(c => ({
        id: c.id,
        fullname: c.fullname,
        shortname: c.shortname,
      }));

    res.json({ courses });
  } catch (err) { next(err); }
};

// ── POST /api/moodle-sync/run ────────────────────────────────────────────────
const triggerSync = async (req, res, next) => {
  try {
    const { session, term } = req.body;

    if (!session || !term) {
      return res.status(400).json({ message: 'session and term are required (e.g. "2025/2026", "FIRST")' });
    }

    const cfg = getMoodleConfig();
    if (!cfg.moodleUrl || !cfg.moodleToken) {
      return res.status(400).json({ message: 'Moodle is not configured. Please save config first.' });
    }
    if (!cfg.courseMap?.length) {
      return res.status(400).json({ message: 'No course mappings configured. Add at least one course in Moodle config.' });
    }

    const logLines = [];
    const onLog    = (entry) => {
      logLines.push({ time: new Date().toISOString(), ...entry });
    };

    const startedAt = new Date().toISOString();
    let result;
    let status = 'success';

    try {
      result = await runSync(cfg, session, term, onLog);
    } catch (syncErr) {
      status = 'error';
      onLog({ type: 'error', message: syncErr.message });
      result = { total: 0, saved: 0, skipped: 0, errors: [syncErr.message] };
    }

    // Persist log entry
    appendLog({
      startedAt,
      completedAt: new Date().toISOString(),
      session,
      term,
      status,
      triggeredBy: req.user?.email || 'system',
      ...result,
      log: logLines,
    });

    res.json({
      message:   status === 'success' ? `Sync complete — ${result.saved} result(s) saved` : 'Sync failed',
      session,
      term,
      status,
      ...result,
      log: logLines,
    });
  } catch (err) { next(err); }
};

// ── GET /api/moodle-sync/logs ────────────────────────────────────────────────
const getLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const logs  = readLogs().slice(0, limit);
    res.json({ logs });
  } catch (err) { next(err); }
};

module.exports = { getConfig, saveConfig, testConnection, getCourses, triggerSync, getLogs };
