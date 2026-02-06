/**
 * JWT Token Generator
 *
 * This utility creates JSON Web Tokens for user authentication.
 * I learned that JWTs are a way to securely transmit information between parties.
 * The token contains the user's ID, and it's signed with our secret key.
 */

const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a user
 * @param {string} userId - The user's MongoDB _id
 * @returns {string} - The signed JWT token
 */
const generateToken = (userId) => {
  // jwt.sign creates a token with:
  // 1. Payload (data we want to store - here just the user id)
  // 2. Secret key (from our .env file)
  // 3. Options (like expiration time)
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = generateToken;
