import express from 'express';
import { getWatchHistory, clearWatchHistory } from '../controllers/watchHistoryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.get('/', protect, getWatchHistory);
router.delete('/', protect, clearWatchHistory);
export default router;
