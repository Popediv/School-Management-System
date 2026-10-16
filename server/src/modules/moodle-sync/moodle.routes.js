/**
 * moodle.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All routes are SUPER_ADMIN only — this touches grade data and Moodle tokens.
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('./moodle.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

const ADMIN = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);
router.use(allowRoles(...ADMIN));

router.get('/config',  ctrl.getConfig);
router.post('/config', ctrl.saveConfig);
router.post('/test',   ctrl.testConnection);
router.get('/courses', ctrl.getCourses);
router.post('/run',    ctrl.triggerSync);
router.get('/logs',    ctrl.getLogs);

module.exports = router;
