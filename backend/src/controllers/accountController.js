import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';

const safeUser = (u) => ({
  id: u.id, username: u.username, email: u.email, phoneNumber: u.phoneNumber,
  fullName: u.fullName, bio: u.bio, avatarUrl: u.avatarUrl, role: u.role,
  status: u.status, earnings: u.earnings, monetizationStatus: u.monetizationStatus,
  monetizationAppliedAt: u.monetizationAppliedAt, monetizationApprovedAt: u.monetizationApprovedAt,
  channelNumber: u.channelNumber, channelName: u.channelName, channelCreatedAt: u.channelCreatedAt,
  createdAt: u.createdAt, updatedAt: u.updatedAt
});

export const exportAccountData = async (req, res) => {
  try {
    const userId = req.userId;
    const [user, posts, comments, likes, followers, following, notifications, vibes, reports, savedPosts, payouts, creatorEarnings, aiMemories, aiConversations, blocksGiven, blocksReceived, mutesGiven, mutesReceived, restrictsGiven, restrictsReceived] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.post.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.comment.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.like.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.follow.findMany({ where: { followerId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.follow.findMany({ where: { followingId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.notification.findMany({ where: { receiverId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.vibe.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.savedPost.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.payout.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.creatorEarning.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.aIMemory.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.aIConversation.findMany({ where: { userId }, include: { messages: true }, orderBy: { createdAt: 'asc' } }),
      prisma.userBlock.findMany({ where: { blockerId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.userBlock.findMany({ where: { blockedId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.userMute.findMany({ where: { muterId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.userMute.findMany({ where: { mutedId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.userRestrict.findMany({ where: { restrictorId: userId }, orderBy: { createdAt: 'asc' } }),
      prisma.userRestrict.findMany({ where: { restrictedId: userId }, orderBy: { createdAt: 'asc' } })
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
    return res.json({ success: true, data: {
      exportedAt: new Date().toISOString(), version: 1, user: safeUser(user),
      posts, comments, likes, followers, following, notifications, vibes, reports,
      savedPosts, payouts, creatorEarnings, aiMemories, aiConversations,
      blocksGiven, blocksReceived, mutesGiven, mutesReceived, restrictsGiven, restrictsReceived
    }});
  } catch (error) {
    console.error('Account export error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export account data' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const password = String(req.body?.password || '');
    if (!password) return res.status(400).json({ success: false, message: 'Password is required to delete your account' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }
    await prisma.$transaction(async (tx) => {
      // Clean up relations whose sender/relation side is restrictive in older schemas.
      await tx.notification.deleteMany({ where: { senderId: userId } });
      await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
      await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.userMute.deleteMany({ where: { OR: [{ muterId: userId }, { mutedId: userId }] } });
      await tx.userRestrict.deleteMany({ where: { OR: [{ restrictorId: userId }, { restrictedId: userId }] } });
      await tx.user.delete({ where: { id: userId } });
    });
    return res.json({ success: true, message: 'Account permanently deleted' });
  } catch (error) {
    console.error('Account deletion error:', error);
    return res.status(500).json({ success: false, message: 'Unable to delete account. Please try again.' });
  }
};
