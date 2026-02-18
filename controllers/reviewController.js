/**
 * Review Controller
 *
 * Handles creating and fetching seller reviews. Buyers can leave a
 * 1-5 star rating plus an optional comment after a completed transaction.
 *
 * I made sure only the buyer from the transaction can leave a review,
 * and each transaction can only be reviewed once. The unique constraint
 * on the Review model handles the DB-level enforcement, but I also check
 * in the controller to give a friendlier error message.
 *
 * The getSellerReviews endpoint is public so anyone browsing the marketplace
 * can see a seller's reputation before buying from them.
 */

const mongoose = require('mongoose');
const Review = require('../models/Review');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

/**
 * @desc    Create a review for a completed transaction
 * @route   POST /api/reviews
 * @access  Private
 *
 * Only the buyer from the transaction can leave a review.
 * Each transaction can only have one review (enforced at DB level too).
 */
const createReview = async (req, res) => {
  try {
    const { transactionId, rating, comment } = req.body;

    // Basic validation before hitting the DB
    if (!transactionId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID and rating are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Find the transaction and populate seller/card info for the notification message
    const transaction = await Transaction.findById(transactionId)
      .populate('seller', 'username')
      .populate('card', 'name');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Only completed transactions can be reviewed
    if (transaction.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed transactions',
      });
    }

    // Only the buyer can leave a review
    if (transaction.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the buyer can review this transaction',
      });
    }

    // Check if this transaction already has a review
    // The unique constraint on the model handles this too, but this gives
    // a nicer error message than the raw MongoDB duplicate key error
    const existingReview = await Review.findOne({ transaction: transactionId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this transaction',
      });
    }

    // Create the review
    const review = await Review.create({
      transaction: transactionId,
      reviewer: req.user._id,
      seller: transaction.seller._id,
      rating,
      comment: comment || '',
    });

    // Populate the review with user info before sending back
    await review.populate('reviewer', 'username avatar');
    await review.populate('seller', 'username avatar');

    // Notify the seller about the review
    // Using transaction.tradeOffer as the relatedOffer since the Notification
    // model requires it - this way clicking the notification goes to the offer page
    try {
      await createNotification(
        transaction.seller._id,
        'review_received',
        `${req.user.username} left a ${rating}-star review on your ${transaction.card?.name || 'card'} sale`,
        transaction.tradeOffer
      );
    } catch (notifErr) {
      // Don't let notification failure break the review creation
      console.warn('Failed to create review notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('CreateReview error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create review',
    });
  }
};

/**
 * @desc    Get all reviews for a seller
 * @route   GET /api/reviews/seller/:sellerId
 * @access  Public
 *
 * Returns the list of reviews plus the average rating and total count.
 * I used MongoDB's aggregate pipeline to calculate the average - it's
 * more efficient than fetching all reviews and calculating in JavaScript.
 */
const getSellerReviews = async (req, res) => {
  try {
    const { sellerId } = req.params;

    // Make sure the seller exists
    const seller = await User.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get all reviews for this seller, newest first
    const reviews = await Review.find({ seller: sellerId })
      .populate('reviewer', 'username avatar')
      .sort({ createdAt: -1 });

    // Calculate the average rating using aggregation
    // This is faster than doing it in JS, especially with lots of reviews
    const stats = await Review.aggregate([
      { $match: { seller: new mongoose.Types.ObjectId(sellerId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        averageRating: stats[0]?.averageRating || 0,
        reviewCount: stats[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('GetSellerReviews error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get seller reviews',
    });
  }
};

/**
 * @desc    Check if a review exists for a specific transaction
 * @route   GET /api/reviews/transaction/:transactionId
 * @access  Private
 *
 * Returns the review if it exists, or null if not.
 * The frontend uses this to decide whether to show "Leave Review"
 * or a "Reviewed" badge on the transactions page.
 */
const getReviewForTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const review = await Review.findOne({ transaction: transactionId })
      .populate('reviewer', 'username avatar');

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('GetReviewForTransaction error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check review status',
    });
  }
};

module.exports = {
  createReview,
  getSellerReviews,
  getReviewForTransaction,
};
