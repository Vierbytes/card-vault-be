/**
 * PriceHistory Model
 *
 * This stores historical price data for cards.
 * I learned that keeping price history lets us show trends in Chart.js,
 * which helps users decide if now is a good time to buy or sell.
 */

const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  // Reference to the Card document
  // Using 'ref' creates a relationship - I can use .populate() to get card details
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true,
    index: true,
  },

  // The price at this point in time
  price: {
    type: Number,
    required: true,
  },

  // When this price was recorded
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },

  // Where the price data came from
  source: {
    type: String,
    default: 'tcgdex',
    enum: ['tcgdex', 'manual', 'import'],
  },

  // Card condition - prices vary by condition
  condition: {
    type: String,
    default: 'near_mint',
    enum: ['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged'],
  },
});

// Compound index for querying price history of a specific card
// This makes "get all prices for card X sorted by date" very fast
priceHistorySchema.index({ card: 1, date: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
