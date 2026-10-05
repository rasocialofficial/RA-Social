import express from 'express';
import { getAds, createAd, updateAd, deleteAd } from '../controllers/adminAdsController.js';
import { getAdminStats, adminLogout, getAdminUsers, updateUserStatus, getAdminPosts, deleteAdminPost, updatePostStatus, changeAdminPassword, getMonetizationApplications, updateMonetizationApplication, getAdminReports, updateReportStatus, getBroadcasts, getBroadcastReach, createBroadcast, getAdminVibes, updateVibeStatus, deleteAdminVibe, getAdminPayouts, updatePayoutStatus, creditCreatorEarning, getCreatorAds, updateCreatorAdStatus } from '../controllers/adminController.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { getAdminNotificationCounts } from '../controllers/adminNotificationsController.js';

const router = express.Router();

router.get('/stats', protectAdmin, getAdminStats);
router.get('/notifications/counts', protectAdmin, getAdminNotificationCounts);
router.post('/logout', protectAdmin, adminLogout);
router.get('/users', protectAdmin, getAdminUsers);
router.patch('/users/:id/status', protectAdmin, updateUserStatus);
router.get('/posts', protectAdmin, getAdminPosts);
router.patch('/posts/:id/status', protectAdmin, updatePostStatus);
router.delete('/posts/:id', protectAdmin, deleteAdminPost);
router.put('/change-password', protectAdmin, changeAdminPassword);
router.get('/monetization', protectAdmin, getMonetizationApplications);
router.patch('/monetization/:id', protectAdmin, updateMonetizationApplication);
router.get('/reports', protectAdmin, getAdminReports);
router.patch('/reports/:id/status', protectAdmin, updateReportStatus);
router.get('/broadcasts/reach', protectAdmin, getBroadcastReach);
router.get('/broadcasts', protectAdmin, getBroadcasts);
router.post('/broadcasts', protectAdmin, createBroadcast);
router.get('/ads', protectAdmin, getAds);
router.post('/ads', protectAdmin, createAd);
router.patch('/ads/:id', protectAdmin, updateAd);
router.delete('/ads/:id', protectAdmin, deleteAd);
router.get('/payouts', protectAdmin, getAdminPayouts);
router.get('/creator-ads', protectAdmin, getCreatorAds);
router.patch('/creator-ads/:id/status', protectAdmin, updateCreatorAdStatus);
router.post('/earnings/:userId', protectAdmin, creditCreatorEarning);
router.patch('/payouts/:id/status', protectAdmin, updatePayoutStatus);
router.get('/vibes', protectAdmin, getAdminVibes);
router.patch('/vibes/:id/status', protectAdmin, updateVibeStatus);
router.delete('/vibes/:id', protectAdmin, deleteAdminVibe);

export default router;
