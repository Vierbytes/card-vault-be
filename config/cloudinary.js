/**
 * Cloudinary Configuration
 *
 * I set this up to handle avatar image uploads. Cloudinary stores the images
 * in the cloud and gives back a URL, which is way easier than trying to
 * manage file storage on the server myself.
 *
 * The multer-storage-cloudinary package connects multer (which handles
 * multipart form data) directly to Cloudinary, so the file goes straight
 * from the user's upload to cloud storage.
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with our account credentials
// These come from the Cloudinary dashboard
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up multer storage to upload directly to Cloudinary
// I'm putting avatars in their own folder to keep things organized
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cardvault/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
  },
});

// Create the multer upload middleware
// Limits file size to 2MB so people can't upload huge images
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

module.exports = { cloudinary, uploadAvatar };
