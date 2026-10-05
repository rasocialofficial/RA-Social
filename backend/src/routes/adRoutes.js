import express from 'express';
import { listActiveAds, recordAdEvent } from '../controllers/adController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.get('/', listActiveAds);
router.post('/:id/event', protect, recordAdEvent);
export default router;
