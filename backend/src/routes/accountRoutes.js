import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { exportAccountData, deleteAccount } from '../controllers/accountController.js';
const router = express.Router();
router.get('/export', protect, exportAccountData);
router.delete('/', protect, deleteAccount);
export default router;
