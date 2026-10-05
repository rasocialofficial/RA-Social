import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getSafetyStatus, toggleSafety } from '../controllers/userSafetyController.js';
const router = express.Router();
router.get('/:userId', protect, getSafetyStatus);
router.post('/:userId/toggle', protect, toggleSafety);
export default router;
