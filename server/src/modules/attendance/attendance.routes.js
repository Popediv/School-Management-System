const express = require('express');
const router  = express.Router();
const ctrl    = require('./attendance.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

const ADMIN = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);
router.post('/',                 allowRoles(...ADMIN, 'TEACHER'), ctrl.mark);
router.get('/class/:classId',    allowRoles(...ADMIN, 'TEACHER'), ctrl.getByClass);
router.get('/student/:studentId',allowRoles(...ADMIN, 'TEACHER', 'PARENT', 'STUDENT'), ctrl.getByStudent);
router.get('/report',            allowRoles(...ADMIN, 'TEACHER'), ctrl.getReport);

module.exports = router;
