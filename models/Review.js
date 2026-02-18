/**
 * Review Model
 *
 * Stores seller reviews from buyers after completed transactions.
 * Each transaction can only have one review (enforced by the unique
 * constraint on the transaction field).
 *
 * I denormalized the seller field here instead of just referencing
 * the transaction - this way I can query all reviews for a seller
 * without having to join through the Transaction collection every time.
 * I learned this trick from how TradeOffer stores both buyer and seller
 * even though you could technically get them from the Listing.
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    // The transaction this review is for
    // unique: true means only one review per transaction at the DB level
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      unique: true,
    },

    // Who wrote the review (the buyer from the transaction)
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Who is being reviewed (the seller from the transaction)
    // Stored directly so we can query by seller without joining Transaction
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Star rating from 1 to 5
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },

    // Optional text review - not everyone wants to write something
    comment: {
      type: String,
      maxlength: [500, 'Review cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// For fetching all reviews for a specific seller, sorted newest first
// This is the main query on the public profile page
reviewSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
