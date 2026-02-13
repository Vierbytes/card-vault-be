/**
 * Message Controller
 *
 * Handles sending and retrieving messages within a trade offer thread.
 * Only the buyer and seller involved in the trade can send/read messages.
 *
 * I kept this pretty simple - no real-time websockets or anything,
 * just basic CRUD. Messages show up when you refresh or visit the page.
 */

const Message = require('../models/Message');
const TradeOffer = require('../models/TradeOffer');

/**
 * @desc    Get all messages for a trade offer
 * @route   GET /api/messages/offer/:offerId
 * @access  Private (buyer or seller only)
 */
const getMessagesForOffer = async (req, res) => {
  try {
    // First verify the user is part of this trade
    const offer = await TradeOffer.findById(req.params.offerId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Trade offer not found',
      });
    }

    const userId = req.user._id.toString();
    if (offer.buyer.toString() !== userId && offer.seller.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these messages',
      });
    }

    // Get messages in chronological order (oldest first)
    const messages = await Message.find({ tradeOffer: req.params.offerId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error('GetMessagesForOffer error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get messages',
    });
  }
};

/**
 * @desc    Send a message in a trade offer thread
 * @route   POST /api/messages
 * @access  Private (buyer or seller only)
 */
const sendMessage = async (req, res) => {
  try {
    const { offerId, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty',
      });
    }

    // Verify the user is part of this trade
    const offer = await TradeOffer.findById(offerId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Trade offer not found',
      });
    }

    const userId = req.user._id.toString();
    if (offer.buyer.toString() !== userId && offer.seller.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this trade',
      });
    }

    // Create the message
    const message = await Message.create({
      tradeOffer: offerId,
      sender: req.user._id,
      content: content.trim(),
    });

    // Populate sender info for the response
    await message.populate('sender', 'username avatar');

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('SendMessage error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message',
    });
  }
};

/**
 * @desc    Mark messages as read in a trade offer thread
 * @route   PUT /api/messages/offer/:offerId/read
 * @access  Private (buyer or seller only)
 */
const markMessagesAsRead = async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.offerId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Trade offer not found',
      });
    }

    const userId = req.user._id.toString();
    if (offer.buyer.toString() !== userId && offer.seller.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Mark all messages from the OTHER person as read
    // (We don't mark our own messages as read - they're already "read" by us)
    await Message.updateMany(
      {
        tradeOffer: req.params.offerId,
        sender: { $ne: req.user._id },
        read: false,
      },
      { read: true }
    );

    res.json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('MarkMessagesAsRead error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark messages as read',
    });
  }
};

module.exports = {
  getMessagesForOffer,
  sendMessage,
  markMessagesAsRead,
};
