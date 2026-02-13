/**
 * Auth Controller
 *
 * Handles user registration, login, and logout.
 * I learned to keep the business logic in controllers, separate from routes.
 * This makes the code more organized and easier to test.
 */

const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists with that email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Check if username is taken
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken',
      });
    }

    // Create the user - password hashing happens in the pre-save hook
    const user = await User.create({
      username,
      email,
      password,
    });

    // Generate a JWT token for immediate login after registration
    const token = generateToken(user._id);

    // Send back user data (without password) and the token
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        favoriteGames: user.favoriteGames,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user by email
    // Need to use .select('+password') because password has select: false in schema
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if password matches using the instance method from our model
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Password matched - generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        favoriteGames: user.favoriteGames,
        avatar: user.avatar,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

/**
 * @desc    Logout user (client-side just deletes token, but this endpoint is here for future use)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  // With JWTs, logout is mainly client-side (delete the token)
  // This endpoint could be used for:
  // - Logging logout events
  // - Invalidating tokens in a blacklist (more advanced)
  // For now, just send a success response

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
