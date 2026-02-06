/**
 * Collection Model
 *
 * This tracks cards that a user owns.
 * It's separate from Listing because a user might have cards they don't want to sell.
 * I learned this is a "junction table" pattern - it connects Users and Cards.
 */

const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
  {
    // Which user owns this card
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which card they have
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
    },

    // How many copies they own
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },

    // Condition of their copy
    condition: {
      type: String,
      enum: ['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged'],
      default: 'near_mint',
    },

    // Optional notes (e.g., "PSA 10 graded", "signed by artist")
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },

    // Price they paid (for tracking collection value vs market)
    purchasePrice: {
      type: Number,
      default: 0,
    },

    // When they acquired it
    acquiredDate: {
      type: Date,
      default: Date.now,
    },

    // Is this card for trade/sale or just display?
    forTrade: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - a user can only have one collection entry per card
// If they have multiple copies, they increase quantity instead
collectionSchema.index({ user: 1, card: 1 }, { unique: true });

module.exports = mongoose.model('Collection', collectionSchema);
