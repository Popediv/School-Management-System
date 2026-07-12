const express  = require('express');
const router   = express.Router();
const ctrl     = require('./student.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');
const upload   = require('../../middleware/upload');

const ADMIN = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);

router.get('/',         allowRoles(...ADMIN, 'TEACHER', 'BURSARY'), ctrl.getAll);
router.post('/',        allowRoles('SUPER_ADMIN'), upload.single('photo'),  ctrl.create);
router.get('/moodle-export', allowRoles('SUPER_ADMIN'), ctrl.exportMoodle);
router.get('/:id',      allowRoles(...ADMIN, 'TEACHER', 'BURSARY', 'PARENT', 'STUDENT'), ctrl.getById);
router.put('/:id',      allowRoles('SUPER_ADMIN'), upload.single('photo'),  ctrl.update);
router.delete('/:id',   allowRoles('SUPER_ADMIN'), ctrl.remove);
router.post('/bulk-promote', allowRoles('SUPER_ADMIN', 'PRINCIPAL'), ctrl.bulkPromote);
router.post('/:id/promote', allowRoles('SUPER_ADMIN', 'PRINCIPAL'), ctrl.promote);

module.exports = router;
