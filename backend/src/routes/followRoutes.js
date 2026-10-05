import express from 'express';
import { followUser, getFollowStatus } from '../controllers/followController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/:userId', protect, followUser);
router.get('/:userId/status', protect, getFollowStatus);

export default router;
