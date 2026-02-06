/**
 * Collection Routes
 *
 * Routes for managing user's card collection.
 * All routes require authentication since collections are private.
 */

const express = require('express');
const router = express.Router();
const {
  getMyCollection,
  addToCollection,
  updateCollectionItem,
  removeFromCollection,
} = require('../controllers/collectionController');
const { protect } = require('../middleware/auth');

// All collection routes require authentication
router.use(protect);

router.get('/', getMyCollection);
router.post('/', addToCollection);
router.put('/:id', updateCollectionItem);
router.delete('/:id', removeFromCollection);

module.exports = router;
