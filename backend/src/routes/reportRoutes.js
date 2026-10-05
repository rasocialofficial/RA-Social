import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getMyReports } from '../controllers/reportController.js';

const router = express.Router();
router.get('/mine', protect, getMyReports);
export default router;
