import express from 'express';
import { getMonetizationStatus, applyForMonetization, getMonetizationAnalytics } from '../controllers/monetizationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/status', protect, getMonetizationStatus);
router.get('/analytics', protect, getMonetizationAnalytics);
router.post('/apply', protect, applyForMonetization);

export default router;
