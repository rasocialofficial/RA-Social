import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listMyLiveSessions, createLiveSession, startLiveSession, endLiveSession, deleteLiveSession } from '../controllers/liveController.js';

const router = express.Router();
router.use(protect);
router.get('/', listMyLiveSessions);
router.post('/', createLiveSession);
router.patch('/:id/start', startLiveSession);
router.patch('/:id/end', endLiveSession);
router.delete('/:id', deleteLiveSession);
export default router;
