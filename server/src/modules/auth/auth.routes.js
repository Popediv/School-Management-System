const express = require('express');
const router  = express.Router();
const { login, logout, getMe, register, changePassword, adminResetPassword } = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

router.post('/login',    login);
router.post('/logout',   logout);
router.get('/me',        authenticate, getMe);

router.post('/change-password', authenticate, changePassword);
router.post('/admin-reset/:id', authenticate, adminResetPassword);

module.exports = router;
