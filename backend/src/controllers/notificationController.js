import prisma from '../config/database.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    const notifications = await prisma.notification.findMany({
      where: { receiverId: userId },
      include: {
        sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        post: { select: { id: true, content: true, mediaUrl: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const unreadCount = await prisma.notification.count({
      where: { receiverId: userId, isRead: false }
    });

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    await prisma.notification.updateMany({
      where: { receiverId: userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notifications' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id }, select: { id: true, receiverId: true } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notification.receiverId !== req.userId) return res.status(403).json({ success: false, message: 'Not authorized' });
    await prisma.notification.delete({ where: { id: notification.id } });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};

export const deleteAllNotifications = async (req, res) => {
  try {
    const result = await prisma.notification.deleteMany({ where: { receiverId: req.userId } });
    res.json({ success: true, message: 'All notifications deleted', data: { count: result.count } });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notifications' });
  }
};
