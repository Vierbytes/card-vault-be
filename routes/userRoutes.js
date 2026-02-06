/**
 * User Routes
 *
 * Routes for user profile management.
 */

const express = require('express');
const router = express.Router();
const {
  getUserById,
  updateProfile,
  updatePassword,
  getUserListings,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Protected routes - current user operations
router.put('/me', protect, updateProfile);
router.put('/me/password', protect, updatePassword);

// Public routes - view other users
router.get('/:id', getUserById);
router.get('/:id/listings', getUserListings);

module.exports = router;
