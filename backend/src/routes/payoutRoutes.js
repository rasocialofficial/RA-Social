import express from 'express';
import { getPayouts, requestPayout } from '../controllers/payoutController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.get('/', protect, getPayouts);
router.post('/', protect, requestPayout);
export default router;
