import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listSessions, logoutCurrentSession, revokeSession, logoutAllSessions } from '../controllers/sessionController.js';
const router = express.Router();
router.get('/', protect, listSessions);
router.post('/logout', protect, logoutCurrentSession);
router.post('/logout-all', protect, logoutAllSessions);
router.delete('/:id', protect, revokeSession);
export default router;
