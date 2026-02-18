# CardVault Backend

Express + MongoDB API for the CardVault Pokemon TCG marketplace.

## Features

- JWT authentication and Auth0 social login exchange
- Card search/details, pricing, and image scan endpoints
- Listings, collections, wishlists, offers, and messaging
- Notifications, transactions, and seller reviews
- Stripe Checkout + webhook handling
- Cloudinary image upload support

## Tech Stack

- Node.js + Express 5
- MongoDB + Mongoose
- JWT (`jsonwebtoken`) + Auth0 JWKS
- Stripe
- Cloudinary + Multer

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set values:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

POKEWALLET_API_KEY=your_pokewallet_api_key
CLIENT_URL=http://localhost:5173
```

## Run Locally

```bash
cd backend
npm install
npm run dev
```

The API runs on `http://localhost:5000` by default.

## API Base URL

`/api`

Health check:

- `GET /api/health`

## Main Route Groups

- `/api/auth`
- `/api/users`
- `/api/cards`
- `/api/listings`
- `/api/collections`
- `/api/wishlists`
- `/api/matches`
- `/api/trade-offers`
- `/api/messages`
- `/api/notifications`
- `/api/payments`
- `/api/transactions`
- `/api/reviews`

## Available Scripts

- `npm run dev` - start with nodemon
- `npm start` - start with Node
