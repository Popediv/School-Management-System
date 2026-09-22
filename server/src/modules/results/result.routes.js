const express = require('express');
const router = express.Router();
const ctrl = require('./result.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');
const multer = require('multer');

const ADMIN = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
const uploadMw = multer({ storage: multer.memoryStorage() });

router.use(authenticate);
router.post('/', allowRoles(...ADMIN, 'TEACHER'), ctrl.upload);
router.post('/upload-teacher-excel', allowRoles(...ADMIN, 'TEACHER'), uploadMw.single('file'), ctrl.uploadTeacherExcel);
router.post('/upload-superadmin-excel', allowRoles('SUPER_ADMIN'), uploadMw.single('file'), ctrl.uploadSuperadminExcel);
router.get('/student/:studentId', allowRoles(...ADMIN, 'TEACHER', 'PARENT', 'STUDENT'), ctrl.getByStudent);
router.get('/report-card/:studentId', allowRoles(...ADMIN, 'TEACHER', 'PARENT', 'STUDENT'), ctrl.getReportCard);
router.post('/calculate', allowRoles(...ADMIN), ctrl.calculate);
router.patch('/:id/publish', allowRoles('SUPER_ADMIN', 'PRINCIPAL'), ctrl.publish);

module.exports = router;
