import express from 'express';
import {
  createPost,
  updatePost,
  getFeed,
  getPostById,
  likePost,
  addComment,
  deletePost,
  viewPost,
  hidePost,
  reportPost,
  getMyCreatorAds
} from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload, cloudinary } from '../config/cloudinary.js';
import axios from 'axios';

const router = express.Router();

router.get('/:id/download', async (req, res) => {
  try {
    const post = await (await import('../config/database.js')).default.post.findUnique({ where: { id: req.params.id }, select: { mediaUrl: true, mediaType: true } });
    if (!post?.mediaUrl) return res.status(404).json({ success: false, message: 'Media not found' });
    const upstream = await axios.get(post.mediaUrl, { responseType: 'stream', timeout: 60000 });
    const contentType = upstream.headers['content-type'] || (post.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="ra-social-${req.params.id}.${post.mediaType === 'video' ? 'mp4' : 'jpg'}"`);
    upstream.data.on('error', () => { if (!res.headersSent) res.status(502); else res.destroy(); });
    upstream.data.pipe(res);
  } catch (error) {
    console.error('Download media error:', error.message);
    res.status(502).json({ success: false, message: 'Unable to download media' });
  }
});
router.post('/upload', protect, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const isVideo = String(req.file.mimetype || '').toLowerCase().startsWith('video/');
  const originalUrl = req.file.secure_url || req.file.path || req.file.url;
  if (!originalUrl) return res.status(500).json({ success: false, message: 'Uploaded media URL was not returned by Cloudinary' });

  // Edited videos are exported by MediaRecorder as WebM on Android Chrome.
  // Deliver those uploads as H.264/AAC MP4 so the same edited post plays
  // reliably in the Home/Reels video players. Images and normal uploads keep
  // their original URL unchanged.
  const url = isVideo && /\.webm(?:[?#].*)?$/i.test(originalUrl)
    ? originalUrl.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,ac_aac/')
    : originalUrl;

  res.json({
    success: true,
    data: {
      url,
      mediaType: isVideo ? 'video' : 'image',
      publicId: req.file.filename || req.file.public_id || null,
      resourceType: req.file.resource_type || (isVideo ? 'video' : 'image')
    }
  });
});
router.post('/', protect, createPost);
router.get('/creator-ads/mine', protect, getMyCreatorAds);
router.get('/feed', getFeed);
router.get('/:id', getPostById);
router.delete('/:id', protect, deletePost);
router.patch('/:id', protect, updatePost);
router.patch('/:id/hide', protect, hidePost);
router.post('/:id/report', protect, reportPost);
router.post('/:id/view', protect, viewPost);
router.post('/:id/like', protect, likePost);
router.post('/:id/comments', protect, addComment);

export default router;