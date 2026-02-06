/**
 * Listing Controller
 *
 * Handles marketplace listing CRUD operations.
 * This is where users can list their cards for sale and manage listings.
 */

const Listing = require('../models/Listing');
const Card = require('../models/Card');

/**
 * @desc    Get all active listings (marketplace)
 * @route   GET /api/listings
 * @access  Public
 */
const getListings = async (req, res) => {
  try {
    const {
      game,
      minPrice,
      maxPrice,
      condition,
      sort = '-createdAt',
      page = 1,
      limit = 20,
    } = req.query;

    // Build query filter
    const filter = { status: 'active' };

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Condition filter
    if (condition) {
      filter.condition = condition;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with populate to get card and seller info
    let query = Listing.find(filter)
      .populate('card', 'name game setName imageUrl currentPrice rarity')
      .populate('seller', 'username avatar')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    // If filtering by game, we need to filter after populate
    // This is a bit inefficient but works for now
    let listings = await query;

    // Filter by game if specified
    if (game) {
      listings = listings.filter(
        (listing) => listing.card?.game?.toLowerCase() === game.toLowerCase()
      );
    }

    // Get total count for pagination
    const total = await Listing.countDocuments(filter);

    res.json({
      success: true,
      count: listings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: listings,
    });
  } catch (error) {
    console.error('GetListings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get listings',
    });
  }
};

/**
 * @desc    Get single listing
 * @route   GET /api/listings/:id
 * @access  Public
 */
const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('card', 'name game setName setCode cardNumber imageUrl currentPrice rarity')
      .populate('seller', 'username avatar bio createdAt');

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found',
      });
    }

    // Increment view count
    listing.viewCount += 1;
    await listing.save();

    res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('GetListingById error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get listing',
    });
  }
};

/**
 * @desc    Create new listing
 * @route   POST /api/listings
 * @access  Private
 */
const createListing = async (req, res) => {
  try {
    const { cardId, card: cardData, price, condition, description, images, quantity } = req.body;

    // Find the card in our database, or create it from the TCGdex data
    // the frontend sends. This is the same pattern used in collection/wishlist.
    let resolvedCardId = cardId;

    if (!resolvedCardId && cardData) {
      const externalId = cardData.externalId;
      if (!externalId) {
        return res.status(400).json({
          success: false,
          message: 'Card ID or card data with an external ID is required',
        });
      }

      // Try to find existing card, or create a new one
      let card = await Card.findOne({ externalId });
      if (!card) {
        card = await Card.create({
          externalId,
          name: cardData.name || 'Unknown Card',
          game: cardData.game || 'pokemon',
          setName: cardData.setName || '',
          imageUrl: cardData.imageUrl || '',
          rarity: cardData.rarity || '',
          currentPrice: cardData.currentPrice || 0,
        });
      }
      resolvedCardId = card._id;
    }

    // Make sure we have a valid card reference
    if (!resolvedCardId) {
      return res.status(404).json({
        success: false,
        message: 'Card not found. Please search for the card first.',
      });
    }

    // Create the listing
    const listing = await Listing.create({
      seller: req.user._id,
      card: resolvedCardId,
      price,
      condition: condition || 'near_mint',
      description: description || '',
      images: images || [],
      quantity: quantity || 1,
    });

    // Populate the listing data for response
    await listing.populate('card', 'name game setName imageUrl currentPrice');
    await listing.populate('seller', 'username');

    res.status(201).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('CreateListing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create listing',
    });
  }
};

/**
 * @desc    Update listing
 * @route   PUT /api/listings/:id
 * @access  Private (owner only)
 */
const updateListing = async (req, res) => {
  try {
    const { price, condition, description, images, quantity, status } = req.body;

    let listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found',
      });
    }

    // Check ownership - only the seller can update
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this listing',
      });
    }

    // Update fields if provided
    if (price !== undefined) listing.price = price;
    if (condition) listing.condition = condition;
    if (description !== undefined) listing.description = description;
    if (images) listing.images = images;
    if (quantity !== undefined) listing.quantity = quantity;
    if (status) listing.status = status;

    await listing.save();

    // Populate for response
    await listing.populate('card', 'name game setName imageUrl currentPrice');
    await listing.populate('seller', 'username');

    res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('UpdateListing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update listing',
    });
  }
};

/**
 * @desc    Delete listing
 * @route   DELETE /api/listings/:id
 * @access  Private (owner only)
 */
const deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found',
      });
    }

    // Check ownership
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this listing',
      });
    }

    await listing.deleteOne();

    res.json({
      success: true,
      message: 'Listing deleted',
    });
  } catch (error) {
    console.error('DeleteListing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete listing',
    });
  }
};

/**
 * @desc    Get current user's listings
 * @route   GET /api/listings/mine
 * @access  Private
 */
const getMyListings = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = { seller: req.user._id };
    if (status) filter.status = status;

    const listings = await Listing.find(filter)
      .populate('card', 'name game setName imageUrl currentPrice')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: listings.length,
      data: listings,
    });
  } catch (error) {
    console.error('GetMyListings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get your listings',
    });
  }
};

module.exports = {
  getListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
};
