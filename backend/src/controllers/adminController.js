import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { cloudinary, getCloudinaryPublicId } from '../config/cloudinary.js';
import { createSessionForUser } from './sessionController.js';
import { sendPasswordResetCode } from '../services/messageService.js';

// POST /api/auth/admin/login
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'admin' || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { tokenId } = await createSessionForUser(user.id, req);
    const token = jwt.sign({ userId: user.id, jti: tokenId, admin: true }, process.env.JWT_SECRET, { expiresIn: '365d' });

    res.json({
      token,
      admin: { id: user.id, username: user.username, email: user.email, fullName: user.fullName }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// POST /api/auth/admin/forgot-password
export const adminForgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findFirst({ where: { email, role: 'admin' }, select: { id: true, email: true, phoneNumber: true } });
    // Keep account existence private.
    if (!user) return res.json({ message: 'If an admin account matches, reset instructions will be sent.' });

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    const challenge = await prisma.passwordResetChallenge.create({
      data: { userId: user.id, otpHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      select: { id: true }
    });
    const devMode = process.env.NODE_ENV !== 'production' && process.env.PASSWORD_RESET_DEV_MODE === 'true';
    if (!devMode) await sendPasswordResetCode({ user, otp });
    return res.json({
      message: devMode ? 'OTP generated in development mode.' : 'If an admin account matches, reset instructions will be sent.',
      data: { challengeId: challenge.id, ...(devMode ? { devOtp: otp } : {}) }
    });
  } catch (error) {
    console.error('Admin forgot password error:', error);
    if (error.message?.includes('not configured') || error.message?.includes('Resend email failed') || error.message?.includes('Twilio SMS failed')) return res.status(503).json({ error: 'Password reset delivery service is not configured correctly.' });
    return res.status(500).json({ error: 'Failed to process request' });
  }
};

// GET /api/admin/stats?range=today|week|month|year
export const getAdminStats = async (req, res) => {
  try {
    const range = String(req.query?.range || 'month').toLowerCase();
    const now = new Date();
    const start = new Date(now);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else if (range === 'week') { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
    else if (range === 'year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
    else { start.setMonth(start.getMonth() - 1); }
    const allowedRange = ['today', 'week', 'month', 'year'].includes(range) ? range : 'month';
    const dateWhere = { createdAt: { gte: start, lte: now } };
    const [totalUsers, totalPosts, totalReels, activeUsers, earningsAgg, totalViews, pendingReports, pendingPayoutsAgg] = await Promise.all([
      prisma.user.count({ where: dateWhere }),
      prisma.post.count({ where: dateWhere }),
      prisma.post.count({ where: { ...dateWhere, mediaType: 'video' } }),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.creatorEarning.aggregate({ where: dateWhere, _sum: { amount: true } }),
      prisma.postView.count({ where: dateWhere }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.payout.aggregate({ where: { status: { in: ['pending', 'approved'] } }, _sum: { amount: true } }),
    ]);
    res.json({
      range: allowedRange, from: start.toISOString(), to: now.toISOString(),
      totalUsers, totalPosts, totalReels, pendingPayouts: pendingPayoutsAgg._sum.amount || 0,
      activeUsers, reportedContent: pendingReports, totalEarnings: earningsAgg._sum.amount || 0, totalViews,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// POST /api/admin/logout
export const adminLogout = async (req, res) => {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded?.jti) {
        await prisma.session.updateMany({ where: { tokenId: decoded.jti, userId: req.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    }
    return res.json({ success: true, message: 'Admin session logged out' });
  } catch (error) {
    console.error('Admin logout error:', error);
    return res.status(500).json({ error: 'Failed to log out admin session' });
  }
};

// GET /api/admin/users?limit=5
export const getAdminUsers = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || 'all');
    const sort = String(req.query.sort || 'joined');
    const q = String(req.query.q || '').trim();
    const where = {
      ...(status !== 'all' && ['active', 'blocked', 'pending'].includes(status) ? { status } : {}),
      ...(q ? { OR: [{ username: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { fullName: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = sort === 'earnings' ? { earnings: 'desc' } : { createdAt: 'desc' };
    // Response stays a plain array (unchanged) so existing callers (e.g. Dashboard) keep working.
    // Pagination is opt-in: pass ?page=2 to fetch the next batch.
    const users = await prisma.user.findMany({ where, orderBy, skip, take: limit, select: { id:true, username:true, fullName:true, email:true, status:true, earnings:true, monetizationStatus:true, createdAt:true } });
    res.json(users.map((u) => ({ id:u.id, username:u.username, full_name:u.fullName, email:u.email, status:u.status, earnings:u.earnings, monetization_status:u.monetizationStatus, created_at:u.createdAt })));
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET /api/admin/posts?limit=20&status=pending
export const getAdminPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { status, type } = req.query;
    const where = {
      ...(status && status !== 'all' ? { status } : {}),
      ...(type === 'video' ? { mediaType: 'video' } : {}),
    };

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        likes: { select: { id: true } },
        comments: { select: { id: true } },
      },
    });

    const mapped = posts.map((p) => ({
      id: p.id,
      content: p.content,
      media_url: p.mediaUrl,
      media_type: p.mediaType,
      author: p.user?.fullName || p.user?.username || 'Unknown',
      likes_count: p.likes.length,
      comments_count: p.comments.length,
      views: p.viewCount || 0,
      status: p.status,
      created_at: p.createdAt,
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Admin posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

// PATCH /api/admin/posts/:id/status
export const updatePostStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved", "pending" or "rejected"' });
    }

    const post = await prisma.post.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    res.json(post);
  } catch (error) {
    console.error('Update post status error:', error);
    res.status(500).json({ error: 'Failed to update post status' });
  }
};

// DELETE /api/admin/posts/:id
export const deleteAdminPost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({ where: { id }, select: { mediaUrl: true, mediaType: true } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.mediaUrl) {
      const publicId = getCloudinaryPublicId(post.mediaUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: post.mediaType === 'video' ? 'video' : 'image'
        });
      }
    }
    await prisma.post.delete({ where: { id } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

// PUT /api/admin/change-password
export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const admin = await prisma.user.findUnique({ where: { id: req.userId } });
    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { passwordHash } }),
      prisma.session.updateMany({ where: { userId: req.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change admin password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};
// PATCH /api/admin/users/:id/status
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "blocked"' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, username: true, status: true },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};


// GET /api/admin/monetization
export const getMonetizationApplications = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { monetizationStatus: 'pending' },
      orderBy: { monetizationAppliedAt: 'asc' },
      select: {
        id: true, username: true, fullName: true, email: true,
        monetizationStatus: true, monetizationAppliedAt: true,
        _count: { select: { followers: true, posts: true } },
      },
    });
    res.json(users.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.fullName,
      email: u.email,
      status: u.monetizationStatus,
      applied_at: u.monetizationAppliedAt,
      followers: u._count.followers,
      posts: u._count.posts,
    })));
  } catch (error) {
    console.error('Admin monetization applications error:', error);
    res.status(500).json({ error: 'Failed to fetch monetization applications' });
  }
};

// PATCH /api/admin/monetization/:id
export const updateMonetizationApplication = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id:true, username:true, monetizationStatus:true } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.monetizationStatus !== 'pending') return res.status(409).json({ error: `Monetization application is already ${existing.monetizationStatus}` });

    const data = {
      monetizationStatus: status === 'approved' ? 'approved' : 'not_eligible',
      ...(status === 'approved' ? { monetizationApprovedAt: new Date() } : { monetizationApprovedAt: null }),
    };

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.params.id },
        data,
        select: { id: true, username: true, monetizationStatus: true, monetizationApprovedAt: true },
      });
      await tx.notification.create({
        data: {
          receiverId: updated.id,
          senderId: req.userId,
          type: status === 'approved' ? 'monetization_approved' : 'monetization_rejected',
          message: status === 'approved' ? 'Your monetization application was approved.' : 'Your monetization application was rejected.',
        },
      });
      return updated;
    });

    res.json(user);
  } catch (error) {
    console.error('Update monetization application error:', error);
    res.status(500).json({ error: 'Failed to update monetization application' });
  }
};


export const getAdminReports = async (req, res) => {
  try {
    const status = String(req.query.status || 'all');
    const reports = await prisma.report.findMany({
      where: status !== 'all' && ['pending','reviewed','resolved','dismissed'].includes(status) ? { status } : {},
      orderBy: { createdAt: 'desc' }, take: 100,
      include: { reporter: { select: { id:true, username:true, fullName:true } }, post: { select: { id:true, content:true, mediaUrl:true, mediaType:true, status:true, user: { select: { id:true, username:true, status:true } } } } }
    });
    res.json(reports);
  } catch (error) { console.error('Admin reports error:', error); res.status(500).json({ error:'Failed to fetch reports' }); }
};

export const updateReportStatus = async (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['pending','reviewed','resolved','dismissed'].includes(status)) return res.status(400).json({ error:'Invalid report status' });
    const report = await prisma.report.update({ where:{ id:req.params.id }, data:{ status } });
    res.json(report);
  } catch (error) { console.error('Update report error:', error); res.status(500).json({ error:'Failed to update report' }); }
};

export const getBroadcasts = async (req, res) => {
  try {
    const audience = String(req.query?.audience || 'all');
    const allowed = ['all', 'all_users', 'active_users', 'paid_users', 'inactive_users'];
    const where = allowed.includes(audience) && audience !== 'all' ? { audience } : {};
    const broadcasts = await prisma.broadcast.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 200),
      include: { _count: { select: { notifications: true } } },
    });
    const ids = broadcasts.map(b => b.id);
    const readCounts = ids.length
      ? await prisma.notification.groupBy({
          by: ['broadcastId', 'isRead'],
          where: { broadcastId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const counts = new Map();
    for (const row of readCounts) {
      const current = counts.get(row.broadcastId) || { read: 0, unread: 0 };
      current[row.isRead ? 'read' : 'unread'] += row._count._all;
      counts.set(row.broadcastId, current);
    }
    res.json(broadcasts.map(b => {
      const c = counts.get(b.id) || { read: 0, unread: 0 };
      const sent = b._count.notifications || b.recipientCount || 0;
      return {
        id: b.id, title: b.title, message: b.message, target: b.audience,
        recipientCount: sent, deliveredCount: sent, readCount: c.read,
        unreadCount: c.unread, readRate: sent ? Math.round((c.read / sent) * 100) : 0,
        time: b.createdAt,
      };
    }));
  } catch (error) { console.error('Broadcast list error:', error); res.status(500).json({ error:'Failed to fetch broadcasts' }); }
};

export const getBroadcastReach = async (req, res) => {
  try {
    const audience = String(req.query?.audience || 'all_users');
    if (!['all_users','active_users','paid_users','inactive_users'].includes(audience)) {
      return res.status(400).json({ error: 'Invalid target audience' });
    }
    const where = audience === 'active_users'
      ? { role: 'user', status: 'active' }
      : audience === 'inactive_users'
        ? { role: 'user', status: { not: 'active' } }
        : audience === 'paid_users'
          ? { role: 'user', monetizationStatus: 'approved' }
          : { role: 'user' };
    const count = await prisma.user.count({ where });
    res.json({ audience, count });
  } catch (error) { console.error('Broadcast reach error:', error); res.status(500).json({ error:'Failed to calculate broadcast reach' }); }
};

export const createBroadcast = async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    const audience = String(req.body?.targetAudience || 'all_users');
    if (!title || !message) return res.status(400).json({ error:'Title and message are required' });
    if (!['all_users','active_users','paid_users','inactive_users'].includes(audience)) return res.status(400).json({ error:'Invalid target audience' });
    const where = audience === 'active_users'
      ? { role:'user', status:'active' }
      : audience === 'inactive_users'
        ? { role:'user', status:{ not:'active' } }
        : audience === 'paid_users'
          ? { role:'user', monetizationStatus:'approved' }
          : { role:'user' };
    const recipients = await prisma.user.findMany({ where, select:{ id:true } });
    const broadcast = await prisma.broadcast.create({ data:{ senderId:req.userId, title, message, audience, recipientCount:recipients.length } });
    if (recipients.length) {
      await prisma.notification.createMany({ data: recipients.map(u => ({
        receiverId:u.id, senderId:req.userId, broadcastId:broadcast.id, type:'broadcast', message:`${title}: ${message}`
      })) });
    }
    res.status(201).json({ id:broadcast.id, title, message, target:audience, recipientCount:recipients.length, deliveredCount:recipients.length, readCount:0, time:broadcast.createdAt });
  } catch (error) { console.error('Create broadcast error:', error); res.status(500).json({ error:'Failed to send broadcast' }); }
};

// GET /api/admin/vibes?limit=50&status=all
export const getAdminVibes = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const requestedStatus = String(req.query.status || 'all');
    const where = ['active', 'removed'].includes(requestedStatus) ? { status: requestedStatus } : {};
    const vibes = await prisma.vibe.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
    });
    res.json(vibes.map(v => ({
      id: v.id,
      media_url: v.mediaUrl,
      media_type: v.mediaType,
      caption: v.caption,
      privacy: v.privacy || 'everyone',
      status: v.status,
      moderation_reason: v.moderationReason,
      moderated_at: v.moderatedAt,
      expires_at: v.expiresAt,
      created_at: v.createdAt,
      user: v.user,
    })));
  } catch (error) {
    console.error('Admin vibes error:', error);
    res.status(500).json({ error: 'Failed to fetch Vibes' });
  }
};

// PATCH /api/admin/vibes/:id/status
export const updateVibeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['active', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "active" or "removed"' });
    }
    const vibe = await prisma.vibe.findUnique({ where: { id } });
    if (!vibe) return res.status(404).json({ error: 'Vibe not found' });
    const updated = await prisma.vibe.update({
      where: { id },
      data: {
        status,
        moderationReason: status === 'removed' ? String(reason || 'Removed by admin').trim().slice(0, 300) : null,
        moderatedAt: new Date(),
      },
      select: { id: true, status: true, moderationReason: true, moderatedAt: true },
    });
    res.json(updated);
  } catch (error) {
    console.error('Admin vibe status error:', error);
    res.status(500).json({ error: 'Failed to update Vibe status' });
  }
};

// DELETE /api/admin/vibes/:id
export const deleteAdminVibe = async (req, res) => {
  try {
    const { id } = req.params;
    const vibe = await prisma.vibe.findUnique({ where: { id } });
    if (!vibe) return res.status(404).json({ error: 'Vibe not found' });
    await prisma.vibe.delete({ where: { id } });
    if (vibe.publicId) {
      try {
        const { cloudinary } = await import('../config/cloudinary.js');
        await cloudinary.uploader.destroy(vibe.publicId, {
          resource_type: vibe.resourceType || (vibe.mediaType === 'video' ? 'video' : 'image'),
          type: 'upload'
        });
      } catch (cleanupError) {
        console.warn('Admin Vibe media cleanup skipped:', cleanupError.message);
      }
    }
    res.json({ message: 'Vibe permanently deleted' });
  } catch (error) {
    console.error('Admin delete vibe error:', error);
    res.status(500).json({ error: 'Failed to delete Vibe' });
  }
};


// GET /api/admin/creator-ads
export const getCreatorAds = async (req, res) => {
  try {
    const status = String(req.query.status || 'all');
    const where = { isCreatorAd: true, ...( ['pending','approved','rejected'].includes(status) ? { status } : {} ) };
    const ads = await prisma.post.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 300,
      include: { user: { select: { id: true, username: true, fullName: true, email: true, channelName: true, channelNumber: true } }, likes: { select: { id: true } }, comments: { select: { id: true } } },
    });
    res.json(ads.map(a => ({ id:a.id, user_id:a.userId, username:a.user.username, full_name:a.user.fullName, email:a.user.email, channel_name:a.user.channelName, channel_number:a.user.channelNumber, content:a.content, media_url:a.mediaUrl, media_type:a.mediaType, status:a.status, likes:a.likes.length, comments:a.comments.length, created_at:a.createdAt, updated_at:a.updatedAt })));
  } catch (error) { console.error('Admin creator ads error:', error); res.status(500).json({ error: 'Failed to fetch Creator Ads' }); }
};

// PATCH /api/admin/creator-ads/:id/status
export const updateCreatorAdStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['approved','rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });
    const ad = await prisma.post.findFirst({ where: { id:req.params.id, isCreatorAd:true }, select: { id:true, userId:true, status:true } });
    if (!ad) return res.status(404).json({ error: 'Creator Ad not found' });
    if (ad.status !== 'pending') return res.status(409).json({ error: `Creator Ad is already ${ad.status}` });
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.post.update({ where: { id:ad.id }, data: { status } });
      await tx.notification.create({
        data: {
          receiverId: ad.userId,
          senderId: req.userId,
          postId: ad.id,
          type: status === 'approved' ? 'creator_ad_approved' : 'creator_ad_rejected',
          message: status === 'approved' ? 'Your Creator Ad was approved.' : 'Your Creator Ad was rejected.',
        },
      });
      return next;
    });
    res.json({ success:true, data:updated });
  } catch (error) { console.error('Update creator ad status error:', error); res.status(500).json({ error: 'Failed to update Creator Ad' }); }
};

// GET /api/admin/payouts
export const getAdminPayouts = async (req, res) => {
  try {
    const status = String(req.query.status || 'all');
    const where = ['pending', 'approved', 'paid', 'rejected'].includes(status) ? { status } : {};
    const payouts = await prisma.payout.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      include: { user: { select: { id: true, username: true, fullName: true, email: true } } },
    });
    res.json(payouts.map((p) => ({ id:p.id, user_id:p.userId, username:p.user.username, full_name:p.user.fullName, email:p.user.email, amount:p.amount, currency:p.currency, method:p.method, account_label:p.accountLabel, status:p.status, admin_note:p.adminNote, requested_at:p.requestedAt, processed_at:p.processedAt, paid_at:p.paidAt })));
  } catch (error) {
    console.error('Admin payouts error:', error);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
};

// PATCH /api/admin/payouts/:id/status
export const updatePayoutStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body || {};
    if (!['approved', 'paid', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid payout status' });

    const result = await prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({ where: { id } });
      if (!payout) throw Object.assign(new Error('Payout not found'), { statusCode: 404 });
      if (payout.status === 'paid' || payout.status === 'rejected') throw Object.assign(new Error(`Payout is already ${payout.status}`), { statusCode: 409 });
      if (status === 'approved' && payout.status !== 'pending') throw Object.assign(new Error('Only pending payouts can be approved'), { statusCode: 409 });
      if (status === 'rejected' && payout.status !== 'pending') throw Object.assign(new Error('Only pending payouts can be rejected'), { statusCode: 409 });
      if (status === 'paid' && payout.status !== 'approved') throw Object.assign(new Error('Only approved payouts can be marked paid'), { statusCode: 409 });

      if (status === 'paid') {
        const updatedUser = await tx.user.updateMany({ where: { id: payout.userId, earnings: { gte: payout.amount } }, data: { earnings: { decrement: payout.amount } } });
        if (updatedUser.count !== 1) throw Object.assign(new Error('Creator balance is insufficient for this payout'), { statusCode: 409 });
      }

      const updated = await tx.payout.update({ where: { id }, data: { status, adminNote: adminNote ? String(adminNote).slice(0, 500) : payout.adminNote, processedAt: new Date(), paidAt: status === 'paid' ? new Date() : payout.paidAt } });
      const type = status === 'approved' ? 'payout_approved' : status === 'paid' ? 'payout_paid' : 'payout_rejected';
      const message = status === 'approved' ? `Your payout of ${payout.currency} ${payout.amount.toFixed(2)} was approved.` : status === 'paid' ? `Your payout of ${payout.currency} ${payout.amount.toFixed(2)} was marked paid.` : `Your payout of ${payout.currency} ${payout.amount.toFixed(2)} was rejected.`;
      await tx.notification.create({ data: { receiverId: payout.userId, senderId: req.userId, type, message } });
      return updated;
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update payout status error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update payout' });
  }
};


// POST /api/admin/earnings/:userId
// Records verified creator revenue in the immutable-ish earning ledger and
// keeps the legacy User.earnings balance in sync for payout compatibility.
export const creditCreatorEarning = async (req, res) => {
  try {
    const { userId } = req.params;
    const amount = Number(req.body?.amount);
    const source = String(req.body?.source || 'other').trim().toLowerCase();
    const description = String(req.body?.description || '').trim().slice(0, 300) || null;
    const postId = req.body?.postId ? String(req.body.postId) : null;
    const allowedSources = new Set(['ads', 'membership', 'tips', 'brand_deal', 'bonus', 'other']);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return res.status(400).json({ error: 'Amount must be greater than 0 and at most 1,000,000' });
    if (!allowedSources.has(source)) return res.status(400).json({ error: 'Invalid earning source' });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, earnings: true } });
      if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      if (postId) {
        const post = await tx.post.findFirst({ where: { id: postId, userId }, select: { id: true } });
        if (!post) throw Object.assign(new Error('Post not found for this creator'), { statusCode: 400 });
      }
      const earning = await tx.creatorEarning.create({ data: { userId, amount, source, description, postId } });
      await tx.user.update({ where: { id: userId }, data: { earnings: { increment: amount } } });
      return earning;
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Credit creator earning error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to record creator earning' });
  }
};
