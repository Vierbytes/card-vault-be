/**
 * Error Handler Middleware
 *
 * This catches errors from route handlers and sends a clean response.
 * I learned that Express needs a 4-parameter function to recognize it as an error handler.
 * Without this, errors would crash the server or show ugly default messages.
 */

const errorHandler = (err, req, res, next) => {
  // Log the error for debugging (in development)
  console.error('Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Default to 500 (Internal Server Error) if no status is set
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Handle specific Mongoose errors with better messages
  // These are common errors I've run into during development

  // Cast Error - happens when an invalid ObjectId is passed
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Resource not found - invalid ID format';
  }

  // Duplicate Key Error - happens when unique constraint is violated
  if (err.code === 11000) {
    statusCode = 400;
    // Extract the field that caused the duplicate
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // Validation Error - happens when required fields are missing or invalid
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // Combine all validation error messages
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(', ');
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired, please log in again';
  }

  // Send the error response
  res.status(statusCode).json({
    success: false,
    message,
    // Only include stack trace in development for debugging
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
