/**
 * Wishlist Model
 *
 * This tracks cards that a user wants to acquire.
 * It's used for the buyer/seller matching feature - we can find sellers
 * who have cards that match what the user is looking for.
 */

const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    // Which user wants this card
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which card they want
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
    },

    // Maximum price they're willing to pay (for matching/alerts)
    maxPrice: {
      type: Number,
      default: null, // null means no limit
    },

    // Minimum condition they'll accept
    minCondition: {
      type: String,
      enum: ['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged'],
      default: 'moderately_played',
    },

    // Priority level for the user
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },

    // Optional notes about why they want it
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// A user can only wishlist each card once
wishlistSchema.index({ user: 1, card: 1 }, { unique: true });

// Index for finding buyers for a specific card (matching feature)
wishlistSchema.index({ card: 1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);
