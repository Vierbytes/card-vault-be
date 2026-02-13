/**
 * Auth0 Social Login Controller
 *
 * Handles the token exchange for social login (Google, X, Apple).
 * The frontend gets an access token from Auth0 after the redirect flow,
 * then sends it here. We verify it, find or create a local user,
 * and return our own JWT so the rest of the app works the same.
 *
 * I spent a while figuring out how JWKS works - basically Auth0 signs
 * tokens with a private key, and we fetch the matching public key
 * to verify the signature. The jwks-rsa library handles all of that.
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Set up a client that fetches Auth0's public signing keys
// cache and rateLimit prevent us from hitting Auth0 too often
const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
});

// Helper function to get the right signing key from Auth0
// Each token has a 'kid' (key ID) in the header that tells us which key to use
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * @desc    Exchange Auth0 access token for our app JWT
 * @route   POST /api/auth/social
 * @access  Public
 */
const socialLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required',
      });
    }

    // Verify the Auth0 access token using their public keys
    // This makes sure the token is legit and wasn't tampered with
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        accessToken,
        getKey,
        {
          audience: process.env.AUTH0_AUDIENCE,
          issuer: `https://${process.env.AUTH0_DOMAIN}/`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    });

    // The 'sub' claim tells us who this user is and which provider they used
    // It looks like "google-oauth2|123456789" or "twitter|987654321"
    const auth0Id = decoded.sub;

    // Fetch the user's profile info from Auth0's userinfo endpoint
    // This gives us their name, email, picture, etc.
    const userinfoResponse = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userInfo = await userinfoResponse.json();

    // Figure out which social provider they used based on the sub claim
    let authProvider = 'local';
    if (auth0Id.startsWith('google-oauth2')) authProvider = 'google';
    else if (auth0Id.startsWith('twitter')) authProvider = 'twitter';
    else if (auth0Id.startsWith('apple')) authProvider = 'apple';

    // Try to find an existing user - check both auth0Id and email
    // Checking email too handles the case where someone signed up with
    // email/password first and later tries Google with the same email
    let user = await User.findOne({
      $or: [{ auth0Id }, { email: userInfo.email }],
    });

    if (user) {
      // User exists - if they don't have an auth0Id yet, link the accounts
      // This means their email/password account is now also connected to Google
      if (!user.auth0Id) {
        user.auth0Id = auth0Id;
        user.authProvider = authProvider;
        await user.save();
      }
    } else {
      // Brand new user from social login - create their account
      // Generate a username from their Auth0 profile info
      const baseUsername = (
        userInfo.nickname ||
        userInfo.name ||
        userInfo.email.split('@')[0]
      )
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 20);

      // Make sure the username is unique by adding random digits if needed
      let username = baseUsername;
      let exists = await User.findOne({ username });
      while (exists) {
        username = baseUsername + Math.floor(Math.random() * 9999);
        exists = await User.findOne({ username });
      }

      user = await User.create({
        username,
        email: userInfo.email,
        auth0Id,
        authProvider,
        avatar: userInfo.picture || '',
      });
    }

    // Generate our own JWT - from here on everything works the same
    // as if they logged in with email/password
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
    console.error('Social login error:', error);
    res.status(401).json({
      success: false,
      message: 'Social authentication failed',
    });
  }
};

module.exports = { socialLogin };
