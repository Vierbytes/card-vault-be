/**
 * Payment Routes
 *
 * Handles Stripe payment-related endpoints.
 *
 * Note: The webhook route does NOT use the protect middleware because
 * Stripe is the one calling it, not our users. Instead, the webhook
 * handler verifies the request using Stripe's signature.
 *
 * Also important: the webhook route is actually mounted in server.js
 * with express.raw() middleware BEFORE express.json(), so req.body
 * stays as a raw buffer for signature verification. The route defined
 * here is just for the checkout session creation.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createCheckoutSession,
  handleWebhook,
} = require('../controllers/paymentController');

// Create a checkout session - only authenticated buyers can do this
router.post('/create-checkout-session', protect, createCheckoutSession);

// Webhook endpoint - Stripe calls this, verified via signature (not JWT)
// This is also mounted separately in server.js with express.raw()
router.post('/webhook', handleWebhook);

module.exports = router;
