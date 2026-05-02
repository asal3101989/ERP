// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout, getMe, getProfile, updateProfile, updateCompany, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const { registerValidation, loginValidation } = require('../middleware/validator');

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/company', authenticate, updateCompany);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
