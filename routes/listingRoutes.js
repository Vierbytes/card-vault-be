/**
 * Listing Routes
 *
 * Routes for marketplace listing operations.
 */

const express = require('express');
const router = express.Router();
const {
  getListings,
  getListingById,
  getFilterOptions,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
} = require('../controllers/listingController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getListings);

// Get filter options (rarity, set names) for marketplace dropdowns
router.get('/filters', getFilterOptions);

// Private routes - put specific routes before :id to avoid conflicts
router.get('/mine', protect, getMyListings);
router.post('/', protect, createListing);

// Routes with :id parameter
router.get('/:id', getListingById);
router.put('/:id', protect, updateListing);
router.delete('/:id', protect, deleteListing);

module.exports = router;
