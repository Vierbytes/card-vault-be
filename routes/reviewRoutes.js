/**
 * Review Routes
 *
 * Handles seller review endpoints. The seller reviews endpoint is
 * public so anyone can see a seller's reputation. Creating reviews
 * and checking review status require authentication.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createReview,
  getSellerReviews,
  getReviewForTransaction,
} = require('../controllers/reviewController');

// Public - anyone can view a seller's reviews
router.get('/seller/:sellerId', getSellerReviews);

// Private - need to be logged in
router.post('/', protect, createReview);
router.get('/transaction/:transactionId', protect, getReviewForTransaction);

module.exports = router;
