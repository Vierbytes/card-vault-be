/**
 * User Controller
 *
 * Handles user profile operations.
 * Separate from auth because these are about managing user data,
 * not about logging in/out.
 */

const User = require('../models/User');
const Listing = require('../models/Listing');

/**
 * @desc    Get user profile by ID (public view)
 * @route   GET /api/users/:id
 * @access  Public
 */
const getUserById = async (req, res) => {
  try {
    // Find user but don't include sensitive data
    const user = await User.findById(req.params.id).select(
      'username bio favoriteGames avatar createdAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('GetUserById error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user',
    });
  }
};

/**
 * @desc    Update current user's profile
 * @route   PUT /api/users/me
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    // Fields that users are allowed to update
    const { username, bio, favoriteGames, avatar } = req.body;

    // Find the user
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken',
        });
      }
      user.username = username;
    }

    // Update other fields if provided
    if (bio !== undefined) user.bio = bio;
    if (favoriteGames) user.favoriteGames = favoriteGames;
    if (avatar !== undefined) user.avatar = avatar;

    // Save the updated user
    await user.save();

    res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        favoriteGames: user.favoriteGames,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile',
    });
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/users/me/password
 * @access  Private
 */
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password (hashing happens in pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('UpdatePassword error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update password',
    });
  }
};

/**
 * @desc    Get all listings by a user
 * @route   GET /api/users/:id/listings
 * @access  Public
 */
const getUserListings = async (req, res) => {
  try {
    // Check if user exists
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get all active listings by this user
    const listings = await Listing.find({
      seller: req.params.id,
      status: 'active',
    })
      .populate('card', 'name game setName imageUrl currentPrice')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: listings.length,
      data: listings,
    });
  } catch (error) {
    console.error('GetUserListings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user listings',
    });
  }
};

module.exports = {
  getUserById,
  updateProfile,
  updatePassword,
  getUserListings,
};
