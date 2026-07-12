const express = require('express');
const router  = express.Router();
const ctrl    = require('./result.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

const ADMIN = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);
router.post('/',                         allowRoles(...ADMIN, 'TEACHER'), ctrl.upload);
router.get('/student/:studentId',        allowRoles(...ADMIN, 'TEACHER', 'PARENT', 'STUDENT'), ctrl.getByStudent);
router.get('/report-card/:studentId',    allowRoles(...ADMIN, 'TEACHER', 'PARENT', 'STUDENT'), ctrl.getReportCard);
router.post('/calculate',                allowRoles(...ADMIN), ctrl.calculate);
router.patch('/:id/publish',             allowRoles('SUPER_ADMIN', 'PRINCIPAL'), ctrl.publish);

module.exports = router;
