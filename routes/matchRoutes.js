/**
 * Match Routes
 *
 * Routes for buyer/seller matching.
 */

const express = require('express');
const router = express.Router();
const { getMatches } = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

// Require authentication for matches
router.get('/', protect, getMatches);

module.exports = router;
