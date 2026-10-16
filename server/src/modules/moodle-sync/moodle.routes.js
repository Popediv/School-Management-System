/**
 * moodle.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All routes are SUPER_ADMIN only — this touches grade data and Moodle tokens.
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('./moodle.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

router.use(authenticate);
router.use(allowRoles('SUPER_ADMIN'));   // only super admins may configure / trigger sync

router.get('/config',  ctrl.getConfig);
router.post('/config', ctrl.saveConfig);
router.post('/test',   ctrl.testConnection);
router.post('/run',    ctrl.triggerSync);
router.get('/logs',    ctrl.getLogs);

module.exports = router;
