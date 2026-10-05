import express from 'express';
import { getNotifications, markAsRead, deleteNotification, deleteAllNotifications } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.put('/read', protect, markAsRead);
router.delete('/', protect, deleteAllNotifications);
router.delete('/:id', protect, deleteNotification);

export default router;
