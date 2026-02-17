/**
 * Notification Model
 *
 * Stores notifications for trade offer events so users can see
 * when something happens on their offers without manually checking.
 *
 * I learned that compound indexes help a lot when you're querying
 * by multiple fields together - like getting all unread notifications
 * for a specific user, sorted by date.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // The user who receives this notification
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // What kind of notification this is
    // This helps the frontend style them differently if needed
    type: {
      type: String,
      enum: ['offer_received', 'offer_accepted', 'offer_declined', 'offer_cancelled'],
      required: true,
    },

    // Human-readable notification message
    // e.g., "JohnDoe made an offer of $25 on your Charizard listing"
    message: {
      type: String,
      required: true,
    },

    // Link back to the trade offer so users can click through
    relatedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TradeOffer',
      required: true,
    },

    // Whether the user has seen/read this notification
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for the most common query:
// "get unread notifications for user X, newest first"
// This makes the polling query (unread count) and the dropdown fetch fast
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
