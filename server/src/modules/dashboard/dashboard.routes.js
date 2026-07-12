const express = require('express');
const router  = express.Router();
const ctrl    = require('./dashboard.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

const ADMIN = ['SUPER_ADMIN','PRINCIPAL','VICE_PRINCIPAL'];

router.use(authenticate);
router.get('/stats', allowRoles(...ADMIN), ctrl.getStats);
router.get('/teacher-stats', allowRoles('TEACHER'), ctrl.getTeacherStats);
router.get('/bursary-stats', allowRoles('SUPER_ADMIN', 'BURSARY'), ctrl.getBursaryStats);
router.get('/parent-stats', allowRoles('PARENT'), ctrl.getParentStats);
router.get('/student-stats', allowRoles('STUDENT'), ctrl.getStudentStats);

module.exports = router;
