/**
 * Auth Routes
 *
 * These routes handle user authentication - registration, login, logout.
 * I'm keeping routes simple - they just connect URLs to controller functions.
 */

const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/authController');
const { socialLogin } = require('../controllers/auth0Controller');
const { protect } = require('../middleware/auth');

// Public routes - no authentication needed
router.post('/register', register);
router.post('/login', login);
router.post('/social', socialLogin);

// Protected routes - require valid JWT
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
