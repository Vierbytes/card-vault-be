/**
 * Match Controller
 *
 * Handles buyer/seller matching feature.
 * This finds potential trades based on:
 * 1. Sellers who have cards on the user's wishlist
 * 2. Buyers who want cards the user has listed
 */

const Wishlist = require('../models/Wishlist');
const Listing = require('../models/Listing');
const Collection = require('../models/Collection');

/**
 * @desc    Get potential matches for current user
 * @route   GET /api/matches
 * @access  Private
 */
const getMatches = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find sellers who have cards on user's wishlist
    // Step 1: Get user's wishlist card IDs
    const wishlist = await Wishlist.find({ user: userId }).select('card maxPrice minCondition');
    const wishlistCardIds = wishlist.map((item) => item.card);

    // Step 2: Find active listings for those cards (not from current user)
    const potentialSellers = await Listing.find({
      card: { $in: wishlistCardIds },
      seller: { $ne: userId },
      status: 'active',
    })
      .populate('card', 'name game setName imageUrl currentPrice')
      .populate('seller', 'username avatar')
      .limit(20);

    // Filter by price and condition preferences
    const matchingSellers = potentialSellers.filter((listing) => {
      const wishlistItem = wishlist.find(
        (w) => w.card.toString() === listing.card._id.toString()
      );
      if (!wishlistItem) return false;

      // Check price if max price is set
      if (wishlistItem.maxPrice && listing.price > wishlistItem.maxPrice) {
        return false;
      }

      // Could add condition filtering here too
      return true;
    });

    // Find buyers who want cards the user has listed
    // Step 1: Get user's active listing card IDs
    const myListings = await Listing.find({
      seller: userId,
      status: 'active',
    }).select('card price condition');
    const myListingCardIds = myListings.map((item) => item.card);

    // Step 2: Find wishlist entries for those cards (not from current user)
    const potentialBuyers = await Wishlist.find({
      card: { $in: myListingCardIds },
      user: { $ne: userId },
    })
      .populate('card', 'name game setName imageUrl currentPrice')
      .populate('user', 'username avatar')
      .limit(20);

    // Match buyers with specific listings and check price compatibility
    const matchingBuyers = potentialBuyers
      .map((wishlistEntry) => {
        const listing = myListings.find(
          (l) => l.card.toString() === wishlistEntry.card._id.toString()
        );
        if (!listing) return null;

        // Check if listing price is within buyer's max price
        const isPriceMatch =
          !wishlistEntry.maxPrice || listing.price <= wishlistEntry.maxPrice;

        return {
          buyer: wishlistEntry.user,
          card: wishlistEntry.card,
          listingId: listing._id,
          listingPrice: listing.price,
          buyerMaxPrice: wishlistEntry.maxPrice,
          isPriceMatch,
          priority: wishlistEntry.priority,
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        // Sellers who have cards you want
        sellersWithWantedCards: matchingSellers.map((listing) => ({
          listing: {
            _id: listing._id,
            price: listing.price,
            condition: listing.condition,
          },
          card: listing.card,
          seller: listing.seller,
        })),

        // Buyers who want cards you're selling
        buyersForYourCards: matchingBuyers,

        // Summary counts
        summary: {
          potentialPurchases: matchingSellers.length,
          potentialSales: matchingBuyers.length,
        },
      },
    });
  } catch (error) {
    console.error('GetMatches error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get matches',
    });
  }
};

module.exports = {
  getMatches,
};
