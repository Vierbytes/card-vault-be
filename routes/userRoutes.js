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
  updateAvatar,
  getUserListings,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../config/cloudinary');

// Protected routes - current user operations
router.put('/me', protect, updateProfile);
router.put('/me/password', protect, updatePassword);
router.put('/me/avatar', protect, uploadAvatar.single('avatar'), updateAvatar);

// Public routes - view other users
router.get('/:id', getUserById);
router.get('/:id/listings', getUserListings);

module.exports = router;
