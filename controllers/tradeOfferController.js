/**
 * Trade Offer Controller
 *
 * Handles all the trade offer logic - creating offers, accepting/declining,
 * viewing sent and received offers. This is like an eBay-style offer system
 * where buyers can negotiate on listings.
 *
 * I had to think carefully about authorization here:
 * - Only the buyer can create or cancel an offer
 * - Only the seller can accept or decline
 * - Both buyer and seller can view the offer details
 */

const TradeOffer = require('../models/TradeOffer');
const Listing = require('../models/Listing');

/**
 * @desc    Create a new trade offer on a listing
 * @route   POST /api/trade-offers
 * @access  Private
 */
const createOffer = async (req, res) => {
  try {
    const { listingId, offeredPrice, initialMessage } = req.body;

    // Find the listing and make sure it exists
    const listing = await Listing.findById(listingId)
      .populate('seller', 'username')
      .populate('card', 'name');

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found',
      });
    }

    // Can't offer on your own listing - that doesn't make sense
    if (listing.seller._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot make an offer on your own listing',
      });
    }

    // Can only offer on active listings
    if (listing.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This listing is no longer active',
      });
    }

    // Create the trade offer
    const tradeOffer = await TradeOffer.create({
      listing: listing._id,
      buyer: req.user._id,
      seller: listing.seller._id,
      card: listing.card._id,
      offeredPrice,
      listingPrice: listing.price,
      initialMessage: initialMessage || '',
    });

    // Populate the refs so the frontend has all the data it needs
    await tradeOffer.populate('listing');
    await tradeOffer.populate('buyer', 'username avatar');
    await tradeOffer.populate('seller', 'username avatar');
    await tradeOffer.populate('card', 'name game setName imageUrl');

    res.status(201).json({
      success: true,
      data: tradeOffer,
    });
  } catch (error) {
    console.error('CreateOffer error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create offer',
    });
  }
};

/**
 * @desc    Get offers I've sent (as a buyer)
 * @route   GET /api/trade-offers/sent
 * @access  Private
 */
const getMyOffersSent = async (req, res) => {
  try {
    const { status } = req.query;

    // Build filter - always filter by current user as buyer
    const filter = { buyer: req.user._id };
    if (status) filter.status = status;

    const offers = await TradeOffer.find(filter)
      .populate('listing', 'price status condition')
      .populate('seller', 'username avatar')
      .populate('card', 'name game setName imageUrl')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    console.error('GetMyOffersSent error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get sent offers',
    });
  }
};

/**
 * @desc    Get offers I've received (as a seller)
 * @route   GET /api/trade-offers/received
 * @access  Private
 */
const getMyOffersReceived = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = { seller: req.user._id };
    if (status) filter.status = status;

    const offers = await TradeOffer.find(filter)
      .populate('listing', 'price status condition')
      .populate('buyer', 'username avatar')
      .populate('card', 'name game setName imageUrl')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    console.error('GetMyOffersReceived error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get received offers',
    });
  }
};

/**
 * @desc    Get a single offer by ID
 * @route   GET /api/trade-offers/:id
 * @access  Private (buyer or seller only)
 */
const getOfferById = async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.id)
      .populate('listing', 'price status condition description')
      .populate('buyer', 'username avatar createdAt')
      .populate('seller', 'username avatar createdAt')
      .populate('card', 'name game setName imageUrl currentPrice rarity');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    // Only the buyer or seller should be able to view this offer
    const userId = req.user._id.toString();
    if (offer.buyer._id.toString() !== userId && offer.seller._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this offer',
      });
    }

    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error('GetOfferById error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get offer',
    });
  }
};

/**
 * @desc    Accept a trade offer (seller only)
 * @route   PUT /api/trade-offers/:id/accept
 * @access  Private (seller only)
 */
const acceptOffer = async (req, res) => {
  try {
    const { responseMessage } = req.body;

    const offer = await TradeOffer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    // Only the seller can accept
    if (offer.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can accept offers',
      });
    }

    // Can only accept pending offers
    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This offer has already been resolved',
      });
    }

    // Update the offer
    offer.status = 'accepted';
    offer.resolvedAt = new Date();
    if (responseMessage) offer.responseMessage = responseMessage;

    await offer.save();

    // Populate for response
    await offer.populate('buyer', 'username avatar');
    await offer.populate('seller', 'username avatar');
    await offer.populate('card', 'name game setName imageUrl');
    await offer.populate('listing', 'price status condition');

    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error('AcceptOffer error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to accept offer',
    });
  }
};

/**
 * @desc    Decline a trade offer (seller only)
 * @route   PUT /api/trade-offers/:id/decline
 * @access  Private (seller only)
 */
const declineOffer = async (req, res) => {
  try {
    const { responseMessage } = req.body;

    const offer = await TradeOffer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    // Only the seller can decline
    if (offer.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can decline offers',
      });
    }

    // Can only decline pending offers
    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This offer has already been resolved',
      });
    }

    offer.status = 'declined';
    offer.resolvedAt = new Date();
    if (responseMessage) offer.responseMessage = responseMessage;

    await offer.save();

    await offer.populate('buyer', 'username avatar');
    await offer.populate('seller', 'username avatar');
    await offer.populate('card', 'name game setName imageUrl');
    await offer.populate('listing', 'price status condition');

    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error('DeclineOffer error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to decline offer',
    });
  }
};

/**
 * @desc    Cancel a trade offer (buyer only)
 * @route   PUT /api/trade-offers/:id/cancel
 * @access  Private (buyer only)
 */
const cancelOffer = async (req, res) => {
  try {
    const offer = await TradeOffer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found',
      });
    }

    // Only the buyer can cancel their own offer
    if (offer.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the buyer can cancel their offer',
      });
    }

    // Can only cancel pending offers
    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This offer has already been resolved',
      });
    }

    offer.status = 'cancelled';
    offer.resolvedAt = new Date();

    await offer.save();

    await offer.populate('buyer', 'username avatar');
    await offer.populate('seller', 'username avatar');
    await offer.populate('card', 'name game setName imageUrl');
    await offer.populate('listing', 'price status condition');

    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error('CancelOffer error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel offer',
    });
  }
};

/**
 * @desc    Get all offers for a specific listing (seller only)
 * @route   GET /api/trade-offers/listing/:listingId
 * @access  Private (listing owner only)
 */
const getOffersForListing = async (req, res) => {
  try {
    // First check that the listing belongs to the current user
    const listing = await Listing.findById(req.params.listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found',
      });
    }

    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view offers for this listing',
      });
    }

    const offers = await TradeOffer.find({ listing: req.params.listingId })
      .populate('buyer', 'username avatar')
      .populate('card', 'name game setName imageUrl')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    console.error('GetOffersForListing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get offers for listing',
    });
  }
};

module.exports = {
  createOffer,
  getMyOffersSent,
  getMyOffersReceived,
  getOfferById,
  acceptOffer,
  declineOffer,
  cancelOffer,
  getOffersForListing,
};
