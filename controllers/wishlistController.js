/**
 * Wishlist Controller
 *
 * Handles user wishlist operations.
 * This lets users track what cards they want to acquire.
 */

const Wishlist = require('../models/Wishlist');
const Card = require('../models/Card');
const Listing = require('../models/Listing');

/**
 * @desc    Get current user's wishlist
 * @route   GET /api/wishlists
 * @access  Private
 */
const getMyWishlist = async (req, res) => {
  try {
    const { game, priority } = req.query;

    const filter = { user: req.user._id };
    if (priority) filter.priority = priority;

    let wishlist = await Wishlist.find(filter)
      .populate('card', 'name game setName imageUrl currentPrice rarity externalId')
      .sort({ priority: -1, createdAt: -1 });

    // Filter by game if specified
    if (game) {
      wishlist = wishlist.filter(
        (item) => item.card?.game?.toLowerCase() === game.toLowerCase()
      );
    }

    // For each wishlist item, count available listings
    const wishlistWithListings = await Promise.all(
      wishlist.map(async (item) => {
        const listingCount = await Listing.countDocuments({
          card: item.card._id,
          status: 'active',
          price: item.maxPrice ? { $lte: item.maxPrice } : { $exists: true },
        });

        return {
          ...item.toObject(),
          availableListings: listingCount,
        };
      })
    );

    res.json({
      success: true,
      count: wishlistWithListings.length,
      data: wishlistWithListings,
    });
  } catch (error) {
    console.error('GetMyWishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get wishlist',
    });
  }
};

/**
 * @desc    Add card to wishlist
 * @route   POST /api/wishlists
 * @access  Private
 */
const addToWishlist = async (req, res) => {
  try {
    const {
      cardId,
      card: cardData,
      maxPrice,
      minCondition = 'moderately_played',
      priority = 'medium',
      notes,
    } = req.body;

    let resolvedCardId = cardId;

    // Same as collection - if frontend sent card data (from TCGdex),
    // find or create the card in our local DB first
    if (!resolvedCardId && cardData) {
      const externalId = cardData.externalId;
      if (!externalId) {
        return res.status(400).json({
          success: false,
          message: 'Card ID or card data with an external ID is required',
        });
      }

      let card = await Card.findOne({ externalId });
      if (!card) {
        card = await Card.create({
          externalId,
          name: cardData.name,
          game: cardData.game || 'pokemon',
          setName: cardData.setName || 'Unknown Set',
          imageUrl: cardData.imageUrl || '',
          rarity: cardData.rarity || 'Common',
          currentPrice: cardData.currentPrice || 0,
        });
      }
      resolvedCardId = card._id;
    }

    // Verify the card exists
    const card = await Card.findById(resolvedCardId);
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found. Please search for the card first.',
      });
    }

    // Check if already wishlisted
    const existing = await Wishlist.findOne({
      user: req.user._id,
      card: resolvedCardId,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Card is already in your wishlist',
      });
    }

    // Create wishlist entry
    const wishlistItem = await Wishlist.create({
      user: req.user._id,
      card: resolvedCardId,
      maxPrice: maxPrice || null,
      minCondition,
      priority,
      notes: notes || '',
    });

    await wishlistItem.populate('card', 'name game setName imageUrl currentPrice externalId');

    res.status(201).json({
      success: true,
      data: wishlistItem,
    });
  } catch (error) {
    console.error('AddToWishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add to wishlist',
    });
  }
};

/**
 * @desc    Update wishlist item
 * @route   PUT /api/wishlists/:id
 * @access  Private (owner only)
 */
const updateWishlistItem = async (req, res) => {
  try {
    const { maxPrice, minCondition, priority, notes } = req.body;

    let wishlistItem = await Wishlist.findById(req.params.id);

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found',
      });
    }

    // Check ownership
    if (wishlistItem.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this item',
      });
    }

    // Update fields
    if (maxPrice !== undefined) wishlistItem.maxPrice = maxPrice;
    if (minCondition) wishlistItem.minCondition = minCondition;
    if (priority) wishlistItem.priority = priority;
    if (notes !== undefined) wishlistItem.notes = notes;

    await wishlistItem.save();

    await wishlistItem.populate('card', 'name game setName imageUrl currentPrice externalId');

    res.json({
      success: true,
      data: wishlistItem,
    });
  } catch (error) {
    console.error('UpdateWishlistItem error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update wishlist item',
    });
  }
};

/**
 * @desc    Remove card from wishlist
 * @route   DELETE /api/wishlists/:id
 * @access  Private (owner only)
 */
const removeFromWishlist = async (req, res) => {
  try {
    const wishlistItem = await Wishlist.findById(req.params.id);

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found',
      });
    }

    // Check ownership
    if (wishlistItem.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this item',
      });
    }

    await wishlistItem.deleteOne();

    res.json({
      success: true,
      message: 'Card removed from wishlist',
    });
  } catch (error) {
    console.error('RemoveFromWishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove from wishlist',
    });
  }
};

module.exports = {
  getMyWishlist,
  addToWishlist,
  updateWishlistItem,
  removeFromWishlist,
};
