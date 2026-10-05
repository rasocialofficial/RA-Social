import prisma from '../config/database.js';

const HISTORY_DAYS = 30;
const cutoffDate = () => new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

export const getWatchHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const cutoff = cutoffDate();

    // Keep the history window self-cleaning even when the periodic server job
    // has not run yet.
    await prisma.postView.deleteMany({ where: { userId, createdAt: { lt: cutoff } } });

    const history = await prisma.postView.findMany({
      where: { userId, createdAt: { gte: cutoff }, post: { status: 'approved' } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        post: {
          include: {
            user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
            likes: { select: { id: true } },
            comments: { select: { id: true } },
            hashtags: { include: { hashtag: { select: { name: true } } } },
          },
        },
      },
    });

    const data = history.map((item) => ({
      watchedAt: item.createdAt,
      post: {
        ...item.post,
        likesCount: item.post.likes.length,
        commentsCount: item.post.comments.length,
        hashtags: item.post.hashtags.map((h) => h.hashtag.name),
      },
    }));

    res.json({ success: true, data, retentionDays: HISTORY_DAYS });
  } catch (error) {
    console.error('Watch history error:', error);
    res.status(500).json({ success: false, message: 'Failed to load watch history' });
  }
};

export const clearWatchHistory = async (req, res) => {
  try {
    await prisma.postView.deleteMany({ where: { userId: req.userId } });
    res.json({ success: true, message: 'Watch history cleared' });
  } catch (error) {
    console.error('Clear watch history error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear watch history' });
  }
};

export const cleanupOldWatchHistory = async () => {
  const result = await prisma.postView.deleteMany({ where: { createdAt: { lt: cutoffDate() } } });
  return result.count;
};
