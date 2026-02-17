/**
 * Transaction Routes
 *
 * Just one route for now - get the user's transaction history.
 * Transactions are created automatically by the payment webhook,
 * so there's no POST endpoint here.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMyTransactions } = require('../controllers/transactionController');

// Get my purchases and sales
router.get('/', protect, getMyTransactions);

module.exports = router;
