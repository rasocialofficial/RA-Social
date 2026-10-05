import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

export const protectAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (decoded.jti) {
      const session = await prisma.session.findFirst({ where: { tokenId: decoded.jti, userId: decoded.userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
      if (!session) return res.status(401).json({ error: 'Session expired or logged out' });
      prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    }

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }

    req.userId = user.id;
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
