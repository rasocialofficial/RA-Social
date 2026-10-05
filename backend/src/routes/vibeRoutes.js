import express from 'express';
import { getVibes, createVibe, deleteVibe } from '../controllers/vibeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.get('/', protect, getVibes);
router.post('/', protect, createVibe);
router.delete('/:id', protect, deleteVibe);
export default router;
