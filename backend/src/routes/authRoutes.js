import express from 'express';
import { register, checkUsername, login, verifyTwoFactorLogin, setupTwoFactor, enableTwoFactor, disableTwoFactor, getTwoFactorStatus, getMe, updateProfile, forgotPassword, verifyOtp, resetPassword, changePassword, createChannel } from '../controllers/authController.js';
import { adminLogin, adminForgotPassword } from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { rateLimit } from '../middleware/rateLimit.js';

const credentialLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 12 });

const router = express.Router();

router.get('/check-username', checkUsername);
router.post('/register', credentialLimit, register);
router.post('/login', credentialLimit, login);
router.post('/2fa/verify-login', verifyTwoFactorLogin);
router.get('/2fa/status', protect, getTwoFactorStatus);
router.post('/2fa/setup', protect, setupTwoFactor);
router.post('/2fa/enable', protect, enableTwoFactor);
router.post('/2fa/disable', protect, disableTwoFactor);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/channel', protect, createChannel);
router.post('/forgot-password', credentialLimit, forgotPassword);
router.post('/verify-otp', credentialLimit, verifyOtp);
router.post('/reset-password', credentialLimit, resetPassword);
router.put('/change-password', protect, changePassword);
router.post('/admin/login', credentialLimit, adminLogin);
router.post('/admin/forgot-password', credentialLimit, adminForgotPassword);

export default router;