import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;
    req.sessionId = decoded.jti || null;
    if (decoded.jti) {
      const session = await prisma.session.findFirst({ where: { tokenId: decoded.jti, userId: decoded.userId, revokedAt: null, expiresAt: { gt: new Date() } } });
      if (!session) return res.status(401).json({ success: false, message: 'Session expired or logged out' });
      prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    }
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};