/**
 * Collection Controller
 *
 * Handles user card collection operations.
 * This lets users track what cards they own.
 */

const Collection = require('../models/Collection');
const Card = require('../models/Card');

/**
 * @desc    Get current user's collection
 * @route   GET /api/collections
 * @access  Private
 */
const getMyCollection = async (req, res) => {
  try {
    const { game, condition, forTrade, sort = '-createdAt' } = req.query;

    // Build filter
    const filter = { user: req.user._id };
    if (condition) filter.condition = condition;
    if (forTrade !== undefined) filter.forTrade = forTrade === 'true';

    let collection = await Collection.find(filter)
      .populate('card', 'name game setName imageUrl currentPrice rarity externalId')
      .sort(sort);

    // Filter by game if specified (need to do this after populate)
    if (game) {
      collection = collection.filter(
        (item) => item.card?.game?.toLowerCase() === game.toLowerCase()
      );
    }

    // Calculate total collection value
    const totalValue = collection.reduce((sum, item) => {
      return sum + (item.card?.currentPrice || 0) * item.quantity;
    }, 0);

    res.json({
      success: true,
      count: collection.length,
      totalValue: Math.round(totalValue * 100) / 100,
      data: collection,
    });
  } catch (error) {
    console.error('GetMyCollection error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get collection',
    });
  }
};

/**
 * @desc    Add card to collection
 * @route   POST /api/collections
 * @access  Private
 */
const addToCollection = async (req, res) => {
  try {
    const {
      cardId,
      card: cardData,
      quantity = 1,
      condition = 'near_mint',
      notes,
      purchasePrice,
      forTrade,
    } = req.body;

    let resolvedCardId = cardId;

    // If the frontend sent card data instead of a cardId, we need to
    // find or create the card in our database first.
    // This happens with TCGdex cards since they come from an external API
    // and aren't stored locally until someone adds them to a collection.
    if (!resolvedCardId && cardData) {
      const externalId = cardData.externalId;
      if (!externalId) {
        return res.status(400).json({
          success: false,
          message: 'Card ID or card data with an external ID is required',
        });
      }

      // Try to find existing card by externalId, or create a new one
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

    // Check if user already has this card in collection
    let collectionItem = await Collection.findOne({
      user: req.user._id,
      card: resolvedCardId,
    });

    if (collectionItem) {
      // Update quantity instead of creating duplicate
      collectionItem.quantity += quantity;
      if (notes) collectionItem.notes = notes;
      if (forTrade !== undefined) collectionItem.forTrade = forTrade;
      await collectionItem.save();
    } else {
      // Create new collection entry
      collectionItem = await Collection.create({
        user: req.user._id,
        card: resolvedCardId,
        quantity,
        condition,
        notes: notes || '',
        purchasePrice: purchasePrice || 0,
        forTrade: forTrade || false,
      });
    }

    // Populate for response
    await collectionItem.populate('card', 'name game setName imageUrl currentPrice');

    res.status(201).json({
      success: true,
      data: collectionItem,
    });
  } catch (error) {
    console.error('AddToCollection error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add to collection',
    });
  }
};

/**
 * @desc    Update collection item
 * @route   PUT /api/collections/:id
 * @access  Private (owner only)
 */
const updateCollectionItem = async (req, res) => {
  try {
    const { quantity, condition, notes, purchasePrice, forTrade } = req.body;

    let collectionItem = await Collection.findById(req.params.id);

    if (!collectionItem) {
      return res.status(404).json({
        success: false,
        message: 'Collection item not found',
      });
    }

    // Check ownership
    if (collectionItem.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this item',
      });
    }

    // Update fields
    if (quantity !== undefined) collectionItem.quantity = quantity;
    if (condition) collectionItem.condition = condition;
    if (notes !== undefined) collectionItem.notes = notes;
    if (purchasePrice !== undefined) collectionItem.purchasePrice = purchasePrice;
    if (forTrade !== undefined) collectionItem.forTrade = forTrade;

    await collectionItem.save();

    await collectionItem.populate('card', 'name game setName imageUrl currentPrice');

    res.json({
      success: true,
      data: collectionItem,
    });
  } catch (error) {
    console.error('UpdateCollectionItem error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update collection item',
    });
  }
};

/**
 * @desc    Remove card from collection
 * @route   DELETE /api/collections/:id
 * @access  Private (owner only)
 */
const removeFromCollection = async (req, res) => {
  try {
    const collectionItem = await Collection.findById(req.params.id);

    if (!collectionItem) {
      return res.status(404).json({
        success: false,
        message: 'Collection item not found',
      });
    }

    // Check ownership
    if (collectionItem.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this item',
      });
    }

    await collectionItem.deleteOne();

    res.json({
      success: true,
      message: 'Card removed from collection',
    });
  } catch (error) {
    console.error('RemoveFromCollection error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove from collection',
    });
  }
};

module.exports = {
  getMyCollection,
  addToCollection,
  updateCollectionItem,
  removeFromCollection,
};
