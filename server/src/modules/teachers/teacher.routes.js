const express = require('express');
const router  = express.Router();
const ctrl    = require('./teacher.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

const ADMIN = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);

router.get('/',     allowRoles(...ADMIN), ctrl.getAll);
router.post('/',    allowRoles('SUPER_ADMIN'), ctrl.create);
router.get('/:id',  allowRoles(...ADMIN), ctrl.getById);
router.put('/:id',  allowRoles('SUPER_ADMIN'), ctrl.update);
router.delete('/:id', allowRoles('SUPER_ADMIN'), ctrl.remove);
router.post('/assign', allowRoles('SUPER_ADMIN', 'PRINCIPAL'), ctrl.assignSubjectClass);

module.exports = router;
