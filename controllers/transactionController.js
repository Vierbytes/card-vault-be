/**
 * Transaction Controller
 *
 * Handles fetching transaction history for users.
 * Transactions are created by the payment webhook when a Stripe
 * payment completes, so this controller is read-only.
 *
 * I split the response into purchases and sales so the frontend
 * can display them in separate tabs without having to filter client-side.
 */

const Transaction = require('../models/Transaction');

/**
 * @desc    Get my transaction history (purchases and sales)
 * @route   GET /api/transactions
 * @access  Private
 */
const getMyTransactions = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all completed transactions where the user is buyer or seller
    const transactions = await Transaction.find({
      $or: [{ buyer: userId }, { seller: userId }],
      status: 'completed',
    })
      .populate('buyer', 'username avatar')
      .populate('seller', 'username avatar')
      .populate('card', 'name game setName imageUrl externalId')
      .populate('tradeOffer', 'offeredPrice listingPrice')
      .sort({ completedAt: -1 });

    // Split into purchases (user was buyer) and sales (user was seller)
    const purchases = transactions.filter(
      (t) => t.buyer._id.toString() === userId.toString()
    );
    const sales = transactions.filter(
      (t) => t.seller._id.toString() === userId.toString()
    );

    res.json({
      success: true,
      data: {
        purchases,
        sales,
      },
    });
  } catch (error) {
    console.error('GetMyTransactions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get transactions',
    });
  }
};

module.exports = {
  getMyTransactions,
};
