/**
 * Models Index
 *
 * This file exports all our models from one place.
 * It makes imports cleaner in other files - instead of multiple imports,
 * we can do: const { User, Card, Listing } = require('./models');
 */

const User = require('./User');
const Card = require('./Card');
const PriceHistory = require('./PriceHistory');
const Listing = require('./Listing');
const Collection = require('./Collection');
const Wishlist = require('./Wishlist');

module.exports = {
  User,
  Card,
  PriceHistory,
  Listing,
  Collection,
  Wishlist,
};
