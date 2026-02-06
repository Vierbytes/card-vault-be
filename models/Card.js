/**
 * Card Model
 *
 * This stores card information fetched from the TCGdex API.
 * I'm caching cards locally so we can track price history over time
 * and link cards to collections, wishlists, and listings.
 */

const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema(
  {
    // The card's ID from TCGdex API (e.g., 'swsh3-136') - this is how we reference it externally
    externalId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Index for faster lookups
    },

    // Basic card information
    name: {
      type: String,
      required: true,
      index: true, // Index for search functionality
    },

    // Which TCG game this card belongs to
    game: {
      type: String,
      required: true,
      enum: [
        'pokemon',
        'magic',
        'yugioh',
        'lorcana',
        'onepiece',
        'digimon',
        'union-arena',
      ],
      index: true,
    },

    // The set/expansion the card is from
    // Not required because TCGdex search results (brief format) don't always include set info
    setName: {
      type: String,
      default: '',
    },

    setCode: {
      type: String,
      default: '',
    },

    // Card number within the set (like "25/102")
    cardNumber: {
      type: String,
      default: '',
    },

    // Rarity level
    rarity: {
      type: String,
      default: 'Common',
    },

    // URL to the card image
    imageUrl: {
      type: String,
      default: '',
    },

    // Current market price (we'll update this periodically)
    currentPrice: {
      type: Number,
      default: 0,
    },

    // When we last fetched price data from the API
    lastPriceUpdate: {
      type: Date,
      default: Date.now,
    },

    // Additional external IDs for cross-referencing with other services
    tcgplayerId: {
      type: String,
      default: '',
    },

    scryfallId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient game + name searches
cardSchema.index({ game: 1, name: 1 });

module.exports = mongoose.model('Card', cardSchema);
