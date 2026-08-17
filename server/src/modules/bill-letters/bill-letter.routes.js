const express = require('express');
const router = express.Router();
const ctrl = require('./bill-letter.controller');
const { authenticate, allowRoles } = require('../../middleware/auth');

const ADMIN_ROLES = ['SUPER_ADMIN', 'BURSARY', 'PRINCIPAL', 'VICE_PRINCIPAL'];

router.use(authenticate);

// Admin routes
router.post('/generate', allowRoles(...ADMIN_ROLES), ctrl.generateLetter);
router.post('/generate-class', allowRoles(...ADMIN_ROLES), ctrl.generateClassLetters);
router.get('/', allowRoles(...ADMIN_ROLES), ctrl.listLetters);
router.delete('/:id', allowRoles(...ADMIN_ROLES), ctrl.deleteLetter);

// Shared: admin + parent + student (parent views their child's letters)
router.get('/student/:studentId', allowRoles(...ADMIN_ROLES, 'PARENT', 'STUDENT'), ctrl.getLettersByStudent);
router.get('/:id', allowRoles(...ADMIN_ROLES, 'PARENT', 'STUDENT'), ctrl.getLetter);

module.exports = router;
