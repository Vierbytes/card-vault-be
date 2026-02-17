/**
 * Notification Controller
 *
 * Handles fetching, reading, and creating notifications.
 * The createNotification helper is used by other controllers
 * (like tradeOfferController) to generate notifications when
 * something happens.
 *
 * I wrapped createNotification in a try/catch so that if
 * notification creation fails for some reason, it won't break
 * the actual trade offer operation. Notifications are nice-to-have,
 * not critical.
 */

const Notification = require('../models/Notification');

/**
 * Helper: Create a notification
 *
 * Called from tradeOfferController when offers are created,
 * accepted, declined, or cancelled. This is not an API endpoint -
 * it's an internal function that other controllers import.
 */
const createNotification = async (userId, type, message, offerId) => {
  try {
    await Notification.create({
      user: userId,
      type,
      message,
      relatedOffer: offerId,
    });
  } catch (error) {
    // Log but don't throw - notification failure shouldn't break
    // the trade offer operation that triggered it
    console.error('Failed to create notification:', error);
  }
};

/**
 * @desc    Get my notifications (newest first)
 * @route   GET /api/notifications
 * @access  Private
 */
const getMyNotifications = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error('GetMyNotifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get notifications',
    });
  }
};

/**
 * @desc    Get count of unread notifications (for the badge)
 * @route   GET /api/notifications/unread-count
 * @access  Private
 *
 * This is the endpoint that gets polled every 30 seconds from
 * the frontend. It's lightweight - just returns a count, no data.
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('GetUnreadCount error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get unread count',
    });
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Make sure this notification belongs to the current user
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification',
      });
    }

    notification.read = true;
    await notification.save();

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('MarkAsRead error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark notification as read',
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/mark-all-read
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('MarkAllAsRead error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark all as read',
    });
  }
};

module.exports = {
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
