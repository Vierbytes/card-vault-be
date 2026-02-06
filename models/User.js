/**
 * User Model
 *
 * This defines what a user looks like in our database.
 * I learned that Mongoose schemas let us define the structure of our documents
 * and add validation, which is super helpful for keeping data clean.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the schema - this is like a blueprint for user documents
const userSchema = new mongoose.Schema(
  {
    // Username must be unique so no two users have the same name
    username: {
      type: String,
      required: [true, 'Please provide a username'],
      unique: true,
      trim: true, // Removes whitespace from both ends
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },

    // Email also needs to be unique for login purposes
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true, // Converts to lowercase automatically
      trim: true,
      // This regex validates email format - I found this pattern online
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },

    // Password - we'll hash this before saving (see pre-save hook below)
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // This means password won't be returned in queries by default
    },

    // Optional bio for user profile
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },

    // What TCG games the user is interested in
    // This helps with the matching feature
    favoriteGames: {
      type: [String],
      default: [],
      // Only allow specific game values
      enum: {
        values: [
          'pokemon',
          'magic',
          'yugioh',
          'lorcana',
          'onepiece',
          'digimon',
          'union-arena',
        ],
        message: '{VALUE} is not a supported game',
      },
    },

    // Profile picture URL (optional)
    avatar: {
      type: String,
      default: '',
    },
  },
  {
    // This adds createdAt and updatedAt fields automatically
    timestamps: true,
  }
);

/**
 * Pre-save Hook for Password Hashing
 *
 * This runs BEFORE a user document is saved to the database.
 * I learned that we should NEVER store plain text passwords - always hash them!
 * bcrypt is a popular library for this because it's secure and handles salting.
 */
userSchema.pre('save', async function () {
  // Only hash the password if it's been modified (or is new)
  // This prevents re-hashing an already hashed password
  if (!this.isModified('password')) {
    return;
  }

  // Generate a salt with 10 rounds (higher = more secure but slower)
  const salt = await bcrypt.genSalt(10);

  // Hash the password with the salt
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance Method: Compare Password
 *
 * This method lets us check if a provided password matches the hashed one.
 * I'm adding this as an instance method so we can call it on any user document.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  // bcrypt.compare handles the hashing of candidatePassword and comparison
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create and export the model
// mongoose.model('User', userSchema) creates a collection called 'users' (lowercase, plural)
module.exports = mongoose.model('User', userSchema);
