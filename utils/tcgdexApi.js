/**
 * TCGdex API Service
 *
 * This is the main data source for CardVault. TCGdex provides everything
 * we need: card images, details, AND pricing data from TCGPlayer (USD)
 * and Cardmarket (EUR).
 *
 * I originally used JustTCG for pricing but it turned out to be unreliable -
 * no images, no direct card lookups. TCGdex has it all in one place.
 *
 * Note: TCGdex is Pokemon TCG only, which is fine for this project.
 *
 * Docs: https://tcgdex.dev/sdks/javascript
 * Pricing: https://tcgdex.dev/markets-prices
 */

const TCGdexSDK = require('@tcgdex/sdk');
const TCGdex = TCGdexSDK.default;
const Query = TCGdexSDK.Query;

// Initialize the SDK with English language
const tcgdex = new TCGdex('en');

/**
 * Search for Pokemon cards by name
 * Uses TCGdex's Query builder to find cards matching the search term
 *
 * I had to learn that the SDK uses a Query.create() builder pattern
 * instead of plain objects. The .equal() method does exact matching
 * and .contains() does partial matching.
 *
 * @param {string} query - The card name to search for
 * @param {number} limit - Max results to return (default 20)
 * @returns {Array} Array of formatted card objects with image URLs
 */
const searchCards = async (query, limit = 20) => {
  try {
    // Using .contains() instead of .equal() so the search is case-insensitive
    // and matches partial names too (e.g., "pika" finds "Pikachu")
    // I learned the hard way that .equal() is case-sensitive and exact only
    const searchQuery = Query.create()
      .contains('name', query)
      .paginate(1, limit);

    const results = await tcgdex.card.list(searchQuery);

    if (!results || results.length === 0) {
      return [];
    }

    // Format results and filter out cards that don't have images
    // Some older/promo cards in TCGdex don't have image data
    const formatted = results.map(formatCardBrief);
    return formatted.filter((card) => card.imageUrl !== '');
  } catch (error) {
    console.error('TCGdex search error:', error.message);
    return [];
  }
};

/**
 * Get a specific Pokemon card by its TCGdex ID
 * Returns full card details including high-quality image URL and pricing
 *
 * @param {string} cardId - The TCGdex card ID (e.g., 'swsh3-136')
 * @returns {Object|null} Formatted card object or null if not found
 */
const getCardById = async (cardId) => {
  try {
    const card = await tcgdex.card.get(cardId);

    if (!card) return null;

    return formatCardFull(card);
  } catch (error) {
    console.error('TCGdex getCardById error:', error.message);
    return null;
  }
};

/**
 * Get a random Pokemon card (useful for featured/trending sections)
 *
 * @returns {Object|null} A random card with image URL
 */
const getRandomCard = async () => {
  try {
    const card = await tcgdex.random.card();
    if (!card) return null;
    return formatCardFull(card);
  } catch (error) {
    console.error('TCGdex random card error:', error.message);
    return null;
  }
};

/**
 * Get multiple random Pokemon cards
 *
 * @param {number} count - How many random cards to get
 * @returns {Array} Array of random card objects
 */
const getRandomCards = async (count = 8) => {
  try {
    const cards = [];
    const seenIds = new Set();
    // The SDK seems to cache random results, so I'm creating a fresh instance
    // for each call to avoid getting the same card over and over.
    // Also skipping cards without images and duplicates.
    let attempts = 0;
    const maxAttempts = count * 4;
    while (cards.length < count && attempts < maxAttempts) {
      attempts++;
      // Fresh SDK instance to bypass caching
      const freshTcgdex = new TCGdex('en');
      const card = await freshTcgdex.random.card();
      if (card && !seenIds.has(card.id)) {
        seenIds.add(card.id);
        const formatted = formatCardFull(card);
        if (formatted.imageUrl) {
          cards.push(formatted);
        }
      }
    }
    return cards;
  } catch (error) {
    console.error('TCGdex random cards error:', error.message);
    return [];
  }
};

/**
 * Build the image URL for a card
 * TCGdex images follow the pattern: {base_image_url}/high.webp
 *
 * @param {string} imageBase - The base image URL from TCGdex
 * @param {string} quality - 'high' or 'low'
 * @param {string} format - 'webp' or 'png'
 * @returns {string} Full image URL
 */
const buildImageUrl = (imageBase, quality = 'high', format = 'webp') => {
  if (!imageBase) return '';
  return `${imageBase}/${quality}.${format}`;
};

/**
 * Extract pricing from TCGdex card data
 * TCGdex includes pricing from TCGPlayer (USD) and Cardmarket (EUR)
 * automatically in the card response. Not every card has pricing though.
 *
 * I'm using TCGPlayer prices since they're in USD which is what
 * most of our users will expect to see.
 *
 * @param {Object} pricing - The raw pricing object from TCGdex
 * @returns {Object} Formatted pricing with currentPrice and variants
 */
const extractPricing = (pricing) => {
  if (!pricing) return { currentPrice: null, prices: null };

  const tcgplayer = pricing.tcgplayer;
  const cardmarket = pricing.cardmarket;

  // Try to get the main price from TCGPlayer (USD)
  // Check normal first, then reverse-holofoil, then holofoil
  let currentPrice = null;
  const prices = {};

  if (tcgplayer) {
    if (tcgplayer.normal) {
      currentPrice = tcgplayer.normal.marketPrice || tcgplayer.normal.midPrice;
      prices.normal = {
        low: tcgplayer.normal.lowPrice,
        mid: tcgplayer.normal.midPrice,
        high: tcgplayer.normal.highPrice,
        market: tcgplayer.normal.marketPrice,
      };
    }
    if (tcgplayer['reverse-holofoil']) {
      const rh = tcgplayer['reverse-holofoil'];
      if (!currentPrice) currentPrice = rh.marketPrice || rh.midPrice;
      prices.reverseHolo = {
        low: rh.lowPrice,
        mid: rh.midPrice,
        high: rh.highPrice,
        market: rh.marketPrice,
      };
    }
    if (tcgplayer.holofoil) {
      const h = tcgplayer.holofoil;
      if (!currentPrice) currentPrice = h.marketPrice || h.midPrice;
      prices.holofoil = {
        low: h.lowPrice,
        mid: h.midPrice,
        high: h.highPrice,
        market: h.marketPrice,
      };
    }
  }

  // Fallback to Cardmarket trend price if no TCGPlayer data
  if (!currentPrice && cardmarket) {
    currentPrice = cardmarket.trend || cardmarket.avg;
  }

  return { currentPrice, prices };
};

/**
 * Format a brief card object from TCGdex list results
 * The list endpoint returns minimal data: id, localId, name, image
 * No pricing in list results - you need to fetch the full card for that
 *
 * @param {Object} card - Raw card data from TCGdex list
 * @returns {Object} Formatted card object
 */
const formatCardBrief = (card) => {
  return {
    id: card.id,
    name: card.name,
    game: 'pokemon',
    imageUrl: card.image ? buildImageUrl(card.image) : '',
    // Brief results don't include set/rarity/price info
    setName: '',
    rarity: '',
    currentPrice: null,
  };
};

/**
 * Format a full card object from TCGdex single card result
 * The get endpoint returns complete card details including pricing
 *
 * @param {Object} card - Raw full card data from TCGdex
 * @returns {Object} Formatted card object with all details and pricing
 */
const formatCardFull = (card) => {
  // Build image URL - card.image is the base URL
  const imageUrl = card.image ? buildImageUrl(card.image) : '';

  // Extract pricing from TCGPlayer/Cardmarket data
  const { currentPrice, prices } = extractPricing(card.pricing);

  return {
    id: card.id,
    name: card.name,
    game: 'pokemon',
    setName: card.set?.name || '',
    setCode: card.set?.id || '',
    cardNumber: card.localId || '',
    rarity: card.rarity || '',
    imageUrl,
    currentPrice,
    prices,
    hp: card.hp || null,
    types: card.types || [],
    illustrator: card.illustrator || '',
    description: card.description || '',
  };
};

module.exports = {
  searchCards,
  getCardById,
  getRandomCard,
  getRandomCards,
  buildImageUrl,
  extractPricing,
  formatCardBrief,
  formatCardFull,
};
