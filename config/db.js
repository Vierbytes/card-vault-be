/**
 * Database Configuration
 *
 * This file handles connecting to MongoDB using Mongoose.
 * I learned that Mongoose is an ODM (Object Data Modeling) library that makes
 * working with MongoDB much easier - it gives us schemas and validation.
 */

const mongoose = require('mongoose');

// This function connects to our MongoDB database
// I'm using async/await because database connections take time
const connectDB = async () => {
  try {
    // mongoose.connect returns a promise, so we await it
    // The connection string comes from our .env file for security
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    // Log success message with the host we connected to
    // conn.connection.host tells us which server we're connected to
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // If connection fails, log the error and exit the process
    // process.exit(1) means exit with failure
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
