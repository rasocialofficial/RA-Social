import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype?.startsWith('video/');
    return {
      folder: 'ra-social',
      resource_type: 'auto', // critical: without this, videos get stored as 'image' resource and won't play
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'webm'],
      // Only apply image resize transformation to images — video transformations need different handling.
      transformation: isVideo ? undefined : [{ width: 1920, height: 1080, crop: 'limit' }],
    };
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

export { cloudinary, upload };