const express = require('express');
const router  = express.Router();
const ctrl    = require('./settings.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');
const upload   = require('../../middleware/upload');

router.get('/', ctrl.getSettings);
router.post('/logo', authenticate, allowRoles('SUPER_ADMIN', 'PRINCIPAL'), upload.single('logo'), ctrl.uploadLogo);

module.exports = router;
