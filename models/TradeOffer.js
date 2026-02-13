/**
 * TradeOffer Model
 *
 * Represents an offer a buyer makes on a listing.
 * I'm storing the seller, card, and listing price directly on the offer
 * so we don't have to look up the listing every time we display an offer.
 * I learned this is called "denormalization" - it trades storage for speed.
 */

const mongoose = require('mongoose');

const tradeOfferSchema = new mongoose.Schema(
  {
    // The listing this offer is for
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },

    // Who is making the offer (the buyer)
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Who owns the listing (the seller)
    // Stored here so we can query "offers received" without joining through Listing
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which card the offer is about - stored for easy display
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
    },

    // The price the buyer is offering
    offeredPrice: {
      type: Number,
      required: [true, 'Please provide an offer price'],
      min: [0.01, 'Offer must be at least $0.01'],
    },

    // Snapshot of the listing price when the offer was made
    // This way we can always show what the asking price was
    listingPrice: {
      type: Number,
      required: true,
    },

    // Current status of the offer
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Optional message from the buyer when they make the offer
    initialMessage: {
      type: String,
      maxlength: [500, 'Message cannot exceed 500 characters'],
      default: '',
    },

    // Optional response from the seller when accepting/declining
    responseMessage: {
      type: String,
      maxlength: [500, 'Response cannot exceed 500 characters'],
      default: '',
    },

    // When the offer was accepted, declined, or cancelled
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
// "Show me all pending offers I've sent"
tradeOfferSchema.index({ buyer: 1, status: 1 });

// "Show me all pending offers I've received"
tradeOfferSchema.index({ seller: 1, status: 1 });

// "Show me all offers on this listing"
tradeOfferSchema.index({ listing: 1, status: 1 });

module.exports = mongoose.model('TradeOffer', tradeOfferSchema);
