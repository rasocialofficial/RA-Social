import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getPublicUser } from '../controllers/userController.js';
const router = express.Router();
router.get('/:id', protect, getPublicUser);
export default router;
