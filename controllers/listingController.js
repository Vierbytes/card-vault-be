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
 *
 * Supports filtering by price range, condition, card name search,
 * rarity, and set name. Card-level filters (search, rarity, setName)
 * work by finding matching Card IDs first, then filtering listings
 * by those IDs. This is more efficient than filtering after populate
 * and keeps pagination counts accurate.
 */
const getListings = async (req, res) => {
  try {
    const {
      search,
      minPrice,
      maxPrice,
      condition,
      rarity,
      setName,
      sort = '-createdAt',
      page = 1,
      limit = 20,
    } = req.query;

    // Build query filter - always start with active listings only
    const filter = { status: 'active' };

    // Price range filter (applies directly to Listing.price)
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Condition filter (applies directly to Listing.condition)
    if (condition) {
      filter.condition = condition;
    }

    // Card-level filters - search by name, rarity, or set
    // I find matching Card IDs first, then use $in to filter listings
    // This way the total count and pagination are accurate
    if (search || rarity || setName) {
      const cardFilter = {};
      if (search) cardFilter.name = { $regex: search, $options: 'i' };
      if (rarity) cardFilter.rarity = rarity;
      if (setName) cardFilter.setName = setName;

      const matchingCards = await Card.find(cardFilter).select('_id');
      filter.card = { $in: matchingCards.map((c) => c._id) };
    }

    // Validate sort option - only allow specific values to prevent injection
    const allowedSorts = ['-createdAt', 'price', '-price', '-viewCount'];
    const sortOption = allowedSorts.includes(sort) ? sort : '-createdAt';

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with populate to get card and seller info
    const listings = await Listing.find(filter)
      .populate('card', 'name game setName imageUrl currentPrice rarity externalId')
      .populate('seller', 'username avatar')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOption);

    // Get total count for pagination (uses same filter so count is accurate)
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
 * @desc    Get available filter options for marketplace dropdowns
 * @route   GET /api/listings/filters
 * @access  Public
 *
 * Returns distinct rarity and set name values from cards that
 * currently have active listings. This way the dropdowns only
 * show options that will actually return results.
 */
const getFilterOptions = async (req, res) => {
  try {
    // Get the card IDs from all active listings
    const activeCardIds = await Listing.find({ status: 'active' }).distinct('card');

    // Get distinct rarity and setName values from those cards
    // Filter out empty strings so the dropdowns don't have blank options
    const rarities = await Card.distinct('rarity', {
      _id: { $in: activeCardIds },
      rarity: { $ne: '' },
    });

    const setNames = await Card.distinct('setName', {
      _id: { $in: activeCardIds },
      setName: { $ne: '' },
    });

    res.json({
      success: true,
      data: {
        rarities: rarities.sort(),
        setNames: setNames.sort(),
      },
    });
  } catch (error) {
    console.error('GetFilterOptions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get filter options',
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
      .populate('card', 'name game setName setCode cardNumber imageUrl currentPrice rarity externalId')
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
    await listing.populate('card', 'name game setName imageUrl currentPrice externalId');
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
    await listing.populate('card', 'name game setName imageUrl currentPrice externalId');
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
      .populate('card', 'name game setName imageUrl currentPrice externalId')
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
  getFilterOptions,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
};
