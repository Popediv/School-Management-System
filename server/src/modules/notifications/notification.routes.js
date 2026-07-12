const express = require('express');
const router  = express.Router();
const ctrl    = require('./notification.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

router.use(authenticate);
router.get('/',    ctrl.getAll);
router.post('/',   allowRoles('SUPER_ADMIN','PRINCIPAL','VICE_PRINCIPAL'), ctrl.create);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', allowRoles('SUPER_ADMIN','PRINCIPAL','VICE_PRINCIPAL'), ctrl.remove);

module.exports = router;
