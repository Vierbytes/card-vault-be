/**
 * Wishlist Routes
 *
 * Routes for managing user's wishlist.
 * All routes require authentication.
 */

const express = require('express');
const router = express.Router();
const {
  getMyWishlist,
  addToWishlist,
  updateWishlistItem,
  removeFromWishlist,
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

// All wishlist routes require authentication
router.use(protect);

router.get('/', getMyWishlist);
router.post('/', addToWishlist);
router.put('/:id', updateWishlistItem);
router.delete('/:id', removeFromWishlist);

module.exports = router;
