/**
 * CardVault API Server
 *
 * This is the main entry point for the backend.
 * It sets up Express, connects to MongoDB, and registers all routes.
 *
 * I learned that organizing middleware and routes in a specific order matters:
 * 1. Core middleware (cors, json parsing)
 * 2. Routes
 * 3. Error handler (must be last)
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables first (before anything else needs them)
dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const cardRoutes = require('./routes/cardRoutes');
const listingRoutes = require('./routes/listingRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const matchRoutes = require('./routes/matchRoutes');
const tradeOfferRoutes = require('./routes/tradeOfferRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// ============================================
// MIDDLEWARE
// ============================================

// Enable CORS - allows frontend to make requests to this API
// I'm setting specific origin instead of '*' for better security
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || 'http://localhost:5173',
//     credentials: true, // Allow cookies/auth headers
//   })
// );

const allowedOrigins = [
  "http://localhost:5173",
  "https://card-vault-teal.vercel.app",
  "https://card-vault-aet07muvp-vierbytes-projects-ffb97f6e.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));


// Parse JSON request bodies
// This lets us access req.body for POST/PUT requests
app.use(express.json());

// Parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES
// ============================================

// Health check endpoint - useful for deployment
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CardVault API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
// Each route file handles its own sub-routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/trade-offers', tradeOfferRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║         CardVault API Server              ║
╠═══════════════════════════════════════════╣
║  Status: Running                          ║
║  Port: ${PORT}                               ║
║  Mode: ${process.env.NODE_ENV || 'development'}                        ║
║  API: http://localhost:${PORT}/api           ║
╚═══════════════════════════════════════════╝
  `);
});
