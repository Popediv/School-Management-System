const express = require('express');
const router  = express.Router();
const ctrl    = require('./class.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

const ADMIN = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);
router.get('/',    ctrl.getAll);
router.post('/',   allowRoles('SUPER_ADMIN'), ctrl.create);
router.get('/:id', allowRoles(...ADMIN, 'TEACHER'), ctrl.getById);
router.put('/:id', allowRoles('SUPER_ADMIN'), ctrl.update);
router.delete('/:id', allowRoles('SUPER_ADMIN'), ctrl.remove);

module.exports = router;
