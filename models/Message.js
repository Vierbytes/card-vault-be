/**
 * Message Model
 *
 * Simple messages within a trade offer thread.
 * Each message belongs to a specific trade offer, and only the
 * buyer and seller involved can send/read messages.
 *
 * I kept this simple - no real-time updates, just fetch on page load.
 * The "read" field lets us track if the other person has seen the message.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Which trade offer this message belongs to
    tradeOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TradeOffer',
      required: true,
      index: true,
    },

    // Who sent this message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The message text
    content: {
      type: String,
      required: [true, 'Message cannot be empty'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },

    // Has the other party read this message?
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fetching messages in order for a trade offer
messageSchema.index({ tradeOffer: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
