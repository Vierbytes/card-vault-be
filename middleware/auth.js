/**
 * Authentication Middleware
 *
 * This middleware protects routes that require a logged-in user.
 * It checks for a valid JWT token and attaches the user to the request.
 *
 * I learned that middleware runs BETWEEN the request and the route handler.
 * If the token is invalid, we stop the request before it reaches the route.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - require authentication
 *
 * This checks for a valid JWT in the Authorization header.
 * Format expected: "Bearer <token>"
 */
const protect = async (req, res, next) => {
  let token;

  // Check if the Authorization header exists and starts with "Bearer"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract the token from "Bearer <token>"
      // split(' ') gives us ['Bearer', '<token>'], and [1] gets the token
      token = req.headers.authorization.split(' ')[1];

      // Verify the token using our secret
      // This throws an error if the token is invalid or expired
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user by the ID stored in the token
      // .select('-password') excludes the password field from the result
      req.user = await User.findById(decoded.id).select('-password');

      // If user doesn't exist anymore (maybe deleted), deny access
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists',
        });
      }

      // Everything is good - move to the next middleware/route handler
      next();
    } catch (error) {
      // Token verification failed (invalid, expired, etc.)
      console.error('Auth middleware error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed',
      });
    }
  }

  // No token was provided at all
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }
};

/**
 * Optional authentication
 *
 * This is for routes that work for both logged-in and anonymous users,
 * but might show different content based on auth status.
 * It won't reject the request if no token is provided.
 */
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token is invalid, but we don't care - just continue without user
      req.user = null;
    }
  }

  // Always continue to the next middleware, even without auth
  next();
};

module.exports = { protect, optionalAuth };
