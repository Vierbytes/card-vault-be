/**
 * Trade Offer Routes
 *
 * All routes for the offer/negotiation system.
 * Every route here requires authentication since you need to be logged in
 * to make, view, or respond to offers.
 *
 * Important: static routes (/sent, /received) come BEFORE the dynamic /:id
 * route, otherwise Express would try to match "sent" as an ID parameter.
 */

const express = require('express');
const router = express.Router();
const {
  createOffer,
  getMyOffersSent,
  getMyOffersReceived,
  getOfferById,
  acceptOffer,
  declineOffer,
  cancelOffer,
  getOffersForListing,
} = require('../controllers/tradeOfferController');
const { protect } = require('../middleware/auth');

// All trade offer routes require authentication
router.post('/', protect, createOffer);
router.get('/sent', protect, getMyOffersSent);
router.get('/received', protect, getMyOffersReceived);
router.get('/listing/:listingId', protect, getOffersForListing);
router.get('/:id', protect, getOfferById);
router.put('/:id/accept', protect, acceptOffer);
router.put('/:id/decline', protect, declineOffer);
router.put('/:id/cancel', protect, cancelOffer);

module.exports = router;
