/**
 * Message Routes
 *
 * Routes for the messaging system within trade offers.
 * All routes require authentication - you need to be logged in
 * and be part of the trade to send/view messages.
 */

const express = require('express');
const router = express.Router();
const {
  getMessagesForOffer,
  sendMessage,
  markMessagesAsRead,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// All message routes require authentication
router.get('/offer/:offerId', protect, getMessagesForOffer);
router.post('/', protect, sendMessage);
router.put('/offer/:offerId/read', protect, markMessagesAsRead);

module.exports = router;
