/**
 * Card Controller
 *
 * Handles card-related operations including searching, viewing, and pricing.
 * Everything goes through TCGdex now - it provides card images, details,
 * AND pricing data from TCGPlayer (USD) and Cardmarket (EUR) all in one place.
 *
 * I originally used JustTCG for pricing but it turned out to be unreliable -
 * no images, no direct card lookups. TCGdex has it all.
 *
 * Note: TCGdex is Pokemon TCG only, which works for this project.
 */

const Card = require('../models/Card');
const PriceHistory = require('../models/PriceHistory');
const tcgdex = require('../utils/tcgdexApi');

/**
 * @desc    Search Pokemon cards
 * @route   GET /api/cards/search
 * @access  Public
 *
 * Uses TCGdex to search by card name. Returns cards with images and
 * basic info. Pricing isn't included in search results (you need to
 * fetch the full card for that).
 */
const searchCards = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query (q) is required',
      });
    }

    const cards = await tcgdex.searchCards(q, parseInt(limit));

    res.json({
      success: true,
      count: cards.length,
      data: cards,
    });
  } catch (error) {
    console.error('SearchCards error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search cards',
    });
  }
};

/**
 * @desc    Get single card by TCGdex ID
 * @route   GET /api/cards/:id
 * @access  Public
 *
 * Returns full card details including high-quality image and pricing
 * from TCGPlayer/Cardmarket. This is so much simpler than the old
 * JustTCG approach which required DB caching and name-based searches.
 */
const getCardById = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch directly from TCGdex - no need for local DB caching anymore
    const card = await tcgdex.getCardById(id);

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found',
      });
    }

    res.json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error('GetCardById error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get card',
    });
  }
};

/**
 * @desc    Get price history for a card (for Chart.js)
 * @route   GET /api/cards/:id/price-history
 * @access  Public
 *
 * TCGdex gives us current pricing but not historical price data.
 * So I return the current price from TCGdex plus any history we've
 * stored locally in our PriceHistory collection. Over time, as users
 * view cards, we can build up price history by recording snapshots.
 */
const getCardPriceHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current pricing from TCGdex
    const card = await tcgdex.getCardById(id);

    // Check if we have any stored history in our local DB
    let history = [];
    const localCard = await Card.findOne({ externalId: id });

    if (localCard) {
      const priceEntries = await PriceHistory.find({ card: localCard._id })
        .sort({ date: 1 })
        .limit(90);

      history = priceEntries.map((entry) => ({
        date: entry.date,
        price: entry.price,
      }));
    }

    // If card exists in TCGdex and we have a local record, save a price snapshot
    // This gradually builds up price history as users view cards
    if (card && card.currentPrice && localCard) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Only save one snapshot per day per card
        const existingToday = await PriceHistory.findOne({
          card: localCard._id,
          date: { $gte: today },
        });

        if (!existingToday) {
          await PriceHistory.create({
            card: localCard._id,
            price: card.currentPrice,
            source: 'tcgdex',
            date: new Date(),
          });
        }
      } catch (histErr) {
        // Price history recording shouldn't break the response
      }
    }

    res.json({
      success: true,
      data: {
        cardId: id,
        cardName: card?.name || id,
        currentPrice: card?.currentPrice || 0,
        prices: card?.prices || null,
        history,
      },
    });
  } catch (error) {
    console.error('GetCardPriceHistory error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get price history',
    });
  }
};

/**
 * @desc    Get random Pokemon cards (for featured/trending sections)
 * @route   GET /api/cards/random
 * @access  Public
 *
 * Returns random cards with images - great for the home page
 * so there's something to show before the user searches.
 */
const getRandomCards = async (req, res) => {
  try {
    const { count = 8 } = req.query;

    const cards = await tcgdex.getRandomCards(parseInt(count));

    res.json({
      success: true,
      count: cards.length,
      data: cards,
    });
  } catch (error) {
    console.error('GetRandomCards error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get random cards',
    });
  }
};

module.exports = {
  searchCards,
  getCardById,
  getCardPriceHistory,
  getRandomCards,
};
