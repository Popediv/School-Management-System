const express = require('express');
const router  = express.Router();
const ctrl    = require('./idcard.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

router.use(authenticate);
router.get('/:studentId',  allowRoles('SUPER_ADMIN','PRINCIPAL'), ctrl.generate);
router.post('/bulk',       allowRoles('SUPER_ADMIN','PRINCIPAL'), ctrl.bulkGenerate);

module.exports = router;
