/**
 * Notification Routes
 *
 * Routes for the notification system. Users can fetch their
 * notifications, check unread count, and mark them as read.
 * All routes require authentication.
 *
 * Important: the /mark-all-read and /unread-count routes have to
 * come before /:id/read, otherwise Express would try to match
 * "mark-all-read" and "unread-count" as an :id parameter.
 */

const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All notification routes require authentication
router.get('/', protect, getMyNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/mark-all-read', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);

module.exports = router;
