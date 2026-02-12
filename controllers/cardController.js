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

const axios = require('axios');
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

/**
 * Extract the card name from Google Cloud Vision OCR text
 *
 * Google Vision is way more accurate than Tesseract at reading
 * the stylized text on Pokemon cards, but we still need to parse
 * the result to pull out just the card name from all the other
 * text on the card (HP, attacks, flavor text, etc.)
 *
 * The name is always at the top of the card, so it's usually
 * the first meaningful line in the OCR output.
 */
function extractCardNameFromVisionText(ocrText) {
  if (!ocrText || ocrText.trim().length === 0) return [];

  const lines = ocrText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  // Patterns for lines that are definitely NOT the card name
  const skipPatterns = [
    /^hp\s*\d+$/i,
    /^\d+\s*hp$/i,
    /^\d+$/,
    /^(fire|water|grass|electric|psychic|fighting|darkness|metal|dragon|fairy|colorless|normal)$/i,
    /^(basic|stage\s*[12]|vstar|vmax|mega|break|gx|ex|v)$/i,
    /^(weakness|resistance|retreat|cost)$/i,
    /^(illustrator|regulation)/i,
    /^\d+\/\d+$/,
    /^[©®™]/,
    /^www\./i,
    /^pokemon/i,
    /^evolves/i,
    /^ability/i,
    /^rule box/i,
    /^trainer/i,
    /^supporter/i,
    /^item$/i,
    /^energy$/i,
  ];

  const candidates = [];

  for (const line of lines) {
    if (line.length < 2) continue;

    const isNoise = skipPatterns.some((pattern) => pattern.test(line));
    if (isNoise) continue;

    // Skip lines that are mostly numbers or special characters
    const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < line.length * 0.3) continue;

    // Clean up the line
    let name = line.replace(/\s+hp\s*\d+.*$/i, '').trim();
    name = name.replace(/^(basic|stage\s*\d+)\s+/i, '').trim();
    name = name.replace(/[|[\]{}]/g, '').trim();

    if (name.length >= 2 && candidates.length < 5) {
      candidates.push(name);
    }
  }

  return candidates;
}

/**
 * @desc    Scan a card image using Google Cloud Vision OCR
 * @route   POST /api/cards/scan
 * @access  Public
 *
 * This is the core of the scanner feature. The user uploads a photo of a card,
 * we send it to Google Cloud Vision API for text detection, parse out the card
 * name, and search TCGdex for matching cards.
 *
 * I switched from Tesseract.js to Google Vision because Tesseract couldn't
 * handle the stylized fonts on Pokemon cards at all. Google Vision is much
 * better at reading text on complex/colorful backgrounds.
 *
 * The frontend also has a manual search fallback so users can correct
 * the detected name if OCR isn't perfect.
 */
const scanCard = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a card image',
      });
    }

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Cloud Vision API key is not configured',
      });
    }

    // Cloudinary gives us a URL for the uploaded image
    const imageUrl = req.file.path;

    // Download the image from Cloudinary and convert to base64
    // I'm sending the actual image data instead of just a URL because
    // the imageUri approach requires Google's servers to fetch the image,
    // which can fail depending on Cloudinary access settings.
    // Base64 is more reliable since we send the image data directly.
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageResponse.data).toString('base64');

    // Call Google Cloud Vision API for text detection
    // TEXT_DETECTION is optimized for reading text in images (signs, labels, etc.)
    // which is perfect for card names with stylized fonts
    const visionResponse = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              { type: 'TEXT_DETECTION' },
            ],
          },
        ],
      }
    );

    // The first textAnnotation has the full concatenated text
    // The rest are individual words/blocks with bounding boxes
    const annotations = visionResponse.data.responses?.[0]?.textAnnotations;
    const ocrText = annotations?.[0]?.description || '';

    if (!ocrText.trim()) {
      return res.json({
        success: true,
        data: {
          extractedText: '',
          searchQuery: null,
          results: [],
          message: 'Could not detect any text on the card. Try searching manually.',
        },
      });
    }

    // Parse the Vision text to find the card name
    const candidates = extractCardNameFromVisionText(ocrText);

    if (candidates.length === 0) {
      return res.json({
        success: true,
        data: {
          extractedText: ocrText,
          searchQuery: null,
          results: [],
          message: 'Could not identify the card name. Try searching manually.',
        },
      });
    }

    // Try each candidate until we get search results from TCGdex
    let results = [];
    let usedQuery = candidates[0];

    for (const candidate of candidates) {
      const searchResults = await tcgdex.searchCards(candidate, 8);
      if (searchResults.length > 0) {
        results = searchResults;
        usedQuery = candidate;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        extractedText: ocrText,
        searchQuery: usedQuery,
        results,
      },
    });
  } catch (error) {
    console.error('ScanCard error:', error);

    // Google Vision API returns helpful error messages
    const visionError = error.response?.data?.error?.message;
    res.status(500).json({
      success: false,
      message: visionError || error.message || 'Failed to scan card image',
    });
  }
};

module.exports = {
  searchCards,
  getCardById,
  getCardPriceHistory,
  getRandomCards,
  scanCard,
};
