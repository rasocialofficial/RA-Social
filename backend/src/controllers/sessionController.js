import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

const getToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const parseTokenId = (req) => {
  try { return jwt.verify(getToken(req), process.env.JWT_SECRET)?.jti || null; } catch { return null; }
};

const cleanUserAgent = (ua) => String(ua || '').slice(0, 500) || null;
const deviceLabel = (ua) => {
  const value = String(ua || '').toLowerCase();
  if (/android/.test(value)) return 'Android device';
  if (/iphone|ipad|ios/.test(value)) return 'iPhone / iPad';
  if (/windows/.test(value)) return 'Windows browser';
  if (/macintosh|mac os/.test(value)) return 'Mac browser';
  if (/linux/.test(value)) return 'Linux browser';
  return 'Web browser';
};

export const createSessionForUser = async (userId, req) => {
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: {
    userId, tokenId, deviceName: deviceLabel(req.headers['user-agent']),
    userAgent: cleanUserAgent(req.headers['user-agent']),
    ipAddress: req.ip ? String(req.ip).slice(0, 100) : null, expiresAt
  }});
  return { tokenId, expiresAt };
};

export const listSessions = async (req, res) => {
  try {
    const currentTokenId = parseTokenId(req);
    await prisma.session.deleteMany({ where: { userId: req.userId, expiresAt: { lt: new Date() } } });
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId, revokedAt: null }, orderBy: { lastSeenAt: 'desc' },
      select: { id: true, tokenId: true, deviceName: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true }
    });
    return res.json({ success: true, data: sessions.map(s => ({ ...s, isCurrent: s.tokenId === currentTokenId, tokenId: undefined })) });
  } catch (error) {
    console.error('List sessions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load active sessions' });
  }
};

export const logoutCurrentSession = async (req, res) => {
  try {
    const tokenId = parseTokenId(req);
    if (tokenId) await prisma.session.updateMany({ where: { userId: req.userId, tokenId, revokedAt: null }, data: { revokedAt: new Date() } });
    return res.json({ success: true, message: 'Current session logged out' });
  } catch (error) {
    console.error('Logout session error:', error);
    return res.status(500).json({ success: false, message: 'Failed to log out session' });
  }
};

export const revokeSession = async (req, res) => {
  try {
    const session = await prisma.session.findFirst({ where: { id: req.params.id, userId: req.userId, revokedAt: null } });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return res.json({ success: true, message: 'Session logged out' });
  } catch (error) {
    console.error('Revoke session error:', error);
    return res.status(500).json({ success: false, message: 'Failed to log out session' });
  }
};

export const logoutAllSessions = async (req, res) => {
  try {
    const now = new Date();
    const result = await prisma.session.updateMany({ where: { userId: req.userId, revokedAt: null }, data: { revokedAt: now } });
    return res.json({ success: true, message: 'All sessions logged out', data: { count: result.count } });
  } catch (error) {
    console.error('Logout all sessions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to log out all sessions' });
  }
};
