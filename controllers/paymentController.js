/**
 * Payment Controller
 *
 * Handles Stripe Checkout integration for processing payments
 * when a buyer wants to pay for an accepted offer.
 *
 * There are two main functions here:
 * 1. createCheckoutSession - creates a Stripe Checkout page for the buyer
 * 2. handleWebhook - receives confirmation from Stripe when payment completes
 *
 * I learned that webhooks are how Stripe tells our server that a payment
 * actually went through. We can't just trust the frontend redirect because
 * the user could close the browser or the redirect could fail. The webhook
 * is the reliable source of truth for payment status.
 *
 * Also learned the hard way that the webhook needs the RAW request body
 * (not parsed JSON) for signature verification. That's why server.js
 * mounts the webhook route with express.raw() BEFORE express.json().
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const TradeOffer = require('../models/TradeOffer');
const Listing = require('../models/Listing');
const Transaction = require('../models/Transaction');
const { createNotification } = require('./notificationController');

/**
 * @desc    Create a Stripe Checkout Session for paying an accepted offer
 * @route   POST /api/payments/create-checkout-session
 * @access  Private (buyer only)
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({
        success: false,
        message: 'Offer ID is required',
      });
    }

    // Find the offer and populate the card info for the checkout page
    const offer = await TradeOffer.findById(offerId)
      .populate('card', 'name imageUrl')
      .populate('seller', 'username');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    // Only the buyer who made the offer can pay for it
    if (offer.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the buyer can pay for this offer',
      });
    }

    // Can only pay for accepted offers (not pending, declined, etc.)
    if (offer.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'This offer is not in an accepted state',
      });
    }

    // Build the line item for Stripe Checkout
    // Stripe needs the price in cents, so multiply by 100
    const lineItem = {
      price_data: {
        currency: 'usd',
        product_data: {
          name: offer.card.name,
          // Only include image if the card has one
          ...(offer.card.imageUrl ? { images: [offer.card.imageUrl] } : {}),
        },
        // Math.round to avoid floating point issues (e.g., 19.99 * 100 = 1998.9999...)
        unit_amount: Math.round(offer.offeredPrice * 100),
      },
      quantity: 1,
    };

    // The URL where Stripe redirects after successful payment
    // {CHECKOUT_SESSION_ID} is a Stripe template variable that gets replaced
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: 'payment',
      success_url: `${clientUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/offers/${offerId}`,
      // Metadata helps us identify which offer this payment is for
      // when the webhook fires later
      metadata: {
        offerId: offerId,
        buyerId: req.user._id.toString(),
        sellerId: offer.seller._id.toString(),
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    console.error('CreateCheckoutSession error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create checkout session',
    });
  }
};

/**
 * @desc    Handle Stripe webhook events
 * @route   POST /api/payments/webhook
 * @access  Public (verified via Stripe signature)
 *
 * Stripe calls this endpoint when payment events happen.
 * We verify the request is actually from Stripe using the webhook secret,
 * then process the event (mainly checkout.session.completed).
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify this request actually came from Stripe
    // req.body must be the raw buffer (not parsed JSON) for this to work
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).json({ message: `Webhook Error: ${error.message}` });
  }

  // Handle the event based on its type
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      // Pull our custom data from the session metadata
      const { offerId, buyerId, sellerId } = session.metadata;

      // Find the offer
      const offer = await TradeOffer.findById(offerId)
        .populate('card', 'name');

      if (!offer) {
        console.error('Webhook: Offer not found:', offerId);
        return res.status(200).json({ received: true });
      }

      // Don't process if already completed (idempotency)
      if (offer.status === 'completed') {
        return res.status(200).json({ received: true });
      }

      // Update the offer status to completed
      offer.status = 'completed';
      offer.resolvedAt = new Date();
      await offer.save();

      // Mark the listing as sold
      await Listing.findByIdAndUpdate(offer.listing, { status: 'sold' });

      // Create the transaction record
      await Transaction.create({
        buyer: buyerId,
        seller: sellerId,
        tradeOffer: offerId,
        listing: offer.listing,
        card: offer.card._id,
        amount: offer.offeredPrice,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        status: 'completed',
        completedAt: new Date(),
      });

      // Notify the seller that payment was received
      await createNotification(
        sellerId,
        'payment_received',
        `Payment of $${offer.offeredPrice} received for your ${offer.card.name} listing`,
        offerId
      );

      console.log(`Payment completed for offer ${offerId}`);
    } catch (error) {
      console.error('Webhook processing error:', error);
      // Still return 200 so Stripe doesn't retry
      // We log the error and can investigate manually
    }
  }

  // Always acknowledge receipt of the webhook
  res.status(200).json({ received: true });
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
};
