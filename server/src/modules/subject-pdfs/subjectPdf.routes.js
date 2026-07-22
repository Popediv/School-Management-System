const express = require('express');
const router  = express.Router();
const ctrl    = require('./subjectPdf.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const ADMINS = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);

// Teachers and admins can list and view
router.get('/',        ctrl.getAll);
router.get('/:id/view', ctrl.viewPdf);

// Only admins can upload/delete/copy
router.post('/',            allowRoles(...ADMINS), upload.uploadPdf.single('pdfFile'), ctrl.create);
router.post('/copy-to-all', allowRoles(...ADMINS), ctrl.copyToAllTerms);
router.delete('/:id',       allowRoles(...ADMINS), ctrl.remove);

module.exports = router;
