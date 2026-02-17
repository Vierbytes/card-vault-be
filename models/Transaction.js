/**
 * Transaction Model
 *
 * Records completed payments between buyers and sellers.
 * Each transaction is tied to a trade offer and stores the Stripe
 * session/payment info so we have a full audit trail.
 *
 * I learned that storing both the Stripe session ID and payment intent ID
 * is important - the session ID is what we get during checkout, and the
 * payment intent ID is what Stripe uses for the actual charge. Having both
 * makes it easier to debug payment issues in the Stripe dashboard.
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    // Who paid (the buyer)
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Who received payment (the seller)
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The trade offer this payment is for
    tradeOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TradeOffer',
      required: true,
    },

    // The listing that was purchased
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },

    // The card that was traded
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
    },

    // How much was paid (in dollars)
    amount: {
      type: Number,
      required: true,
    },

    // Stripe Checkout Session ID - used to create the checkout page
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Stripe Payment Intent ID - the actual charge reference
    stripePaymentIntentId: {
      type: String,
    },

    // Payment status
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },

    // When the payment was confirmed
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fetching a user's purchase/sale history quickly
transactionSchema.index({ buyer: 1, createdAt: -1 });
transactionSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
