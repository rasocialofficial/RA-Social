import prisma from '../config/database.js';

export const getMyReports = async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: { reporterId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        post: {
          select: {
            id: true,
            content: true,
            mediaUrl: true,
            mediaType: true,
            thumbnailUrl: true,
            status: true,
            createdAt: true,
            user: { select: { id: true, username: true, fullName: true, avatarUrl: true } }
          }
        }
      }
    });
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('My reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to load report history' });
  }
};
