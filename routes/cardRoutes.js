/**
 * Card Routes
 *
 * Routes for card search, lookup, and price history.
 * Everything goes through TCGdex now (Pokemon TCG only).
 * All routes are public since users should be able to browse without logging in.
 */

const express = require('express');
const router = express.Router();
const {
  searchCards,
  getCardById,
  getCardPriceHistory,
  getRandomCards,
  scanCard,
} = require('../controllers/cardController');
const { uploadScanImage } = require('../config/cloudinary');

// Search Pokemon cards by name
// GET /api/cards/search?q=pikachu&limit=20
router.get('/search', searchCards);

// Get random cards (for featured/trending on home page)
// GET /api/cards/random?count=8
router.get('/random', getRandomCards);

// Scan a card image with OCR and search for matches
// POST /api/cards/scan
// Accepts a single image file under the "cardImage" field
router.post('/scan', uploadScanImage.single('cardImage'), scanCard);

// Get price history for charts
// GET /api/cards/:id/price-history
// This needs to come BEFORE /:id so "price-history" isn't treated as an ID
router.get('/:id/price-history', getCardPriceHistory);

// Get specific card details by TCGdex ID
// GET /api/cards/swsh3-136
router.get('/:id', getCardById);

module.exports = router;
