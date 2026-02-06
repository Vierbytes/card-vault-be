/**
 * Listing Model
 *
 * This represents a card that a user has put up for sale.
 * The seller sets their price, and other users can see and buy it.
 */

const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    // Who is selling this card
    // Using ref to create a relationship with the User model
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which card is being sold
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
      index: true,
    },

    // The asking price set by the seller
    price: {
      type: Number,
      required: [true, 'Please set a price for your listing'],
      min: [0.01, 'Price must be at least $0.01'],
    },

    // Physical condition of the card
    condition: {
      type: String,
      required: true,
      enum: {
        values: ['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged'],
        message: '{VALUE} is not a valid condition',
      },
      default: 'near_mint',
    },

    // Current status of the listing
    status: {
      type: String,
      enum: ['active', 'sold', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },

    // Optional description from the seller
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },

    // Seller can upload their own photos of the actual card
    images: {
      type: [String],
      default: [],
    },

    // How many times this listing has been viewed
    // Helpful for sellers to see interest
    viewCount: {
      type: Number,
      default: 0,
    },

    // Quantity available (some sellers have multiples)
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
  },
  {
    timestamps: true,
  }
);

// Index for marketplace queries - active listings sorted by date
listingSchema.index({ status: 1, createdAt: -1 });

// Index for finding listings by card
listingSchema.index({ card: 1, status: 1 });

module.exports = mongoose.model('Listing', listingSchema);
