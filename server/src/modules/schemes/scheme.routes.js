const express = require('express');
const router = express.Router();
const ctrl = require('./scheme.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const ADMINS = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);

router.post('/', allowRoles(...ADMINS), upload.uploadDoc.single('notesFile'), ctrl.create);
router.put('/:id', allowRoles(...ADMINS), upload.uploadDoc.single('notesFile'), ctrl.update);
router.delete('/:id', allowRoles(...ADMINS), ctrl.remove);

module.exports = router;
