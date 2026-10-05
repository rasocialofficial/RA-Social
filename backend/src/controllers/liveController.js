import prisma from '../config/database.js';

const normalizeTitle = (v) => String(v || '').trim().slice(0, 120);
const normalizeDescription = (v) => String(v || '').trim().slice(0, 1000) || null;

export const listMyLiveSessions = async (req, res) => {
  try {
    const items = await prisma.creatorLiveSession.findMany({
      where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('List creator live sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load live sessions' });
  }
};

export const createLiveSession = async (req, res) => {
  try {
    const title = normalizeTitle(req.body?.title);
    const description = normalizeDescription(req.body?.description);
    if (!title) return res.status(400).json({ success: false, message: 'Live title is required' });
    const creator = await prisma.user.findUnique({ where: { id: req.userId }, select: { channelNumber: true } });
    if (!creator?.channelNumber) return res.status(403).json({ success: false, message: 'Create your creator channel first' });
    const session = await prisma.creatorLiveSession.create({ data: { userId: req.userId, title, description, status: 'scheduled' } });
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Create live session error:', error);
    res.status(500).json({ success: false, message: 'Failed to create live session' });
  }
};

export const startLiveSession = async (req, res) => {
  try {
    const existing = await prisma.creatorLiveSession.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Live session not found' });
    if (!['scheduled', 'ended'].includes(existing.status)) return res.status(409).json({ success: false, message: 'Live session cannot be started from its current state' });
    const session = await prisma.creatorLiveSession.update({ where: { id: existing.id }, data: { status: 'live', startedAt: new Date(), endedAt: null } });
    res.json({ success: true, data: session });
  } catch (error) { console.error('Start live session error:', error); res.status(500).json({ success: false, message: 'Failed to start live session' }); }
};

export const endLiveSession = async (req, res) => {
  try {
    const existing = await prisma.creatorLiveSession.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Live session not found' });
    if (existing.status !== 'live') return res.status(409).json({ success: false, message: 'Only a live session can be ended' });
    const session = await prisma.creatorLiveSession.update({ where: { id: existing.id }, data: { status: 'ended', endedAt: new Date() } });
    res.json({ success: true, data: session });
  } catch (error) { console.error('End live session error:', error); res.status(500).json({ success: false, message: 'Failed to end live session' }); }
};

export const deleteLiveSession = async (req, res) => {
  try {
    const existing = await prisma.creatorLiveSession.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Live session not found' });
    if (existing.status === 'live') return res.status(409).json({ success: false, message: 'End the live session before deleting it' });
    await prisma.creatorLiveSession.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Live session deleted' });
  } catch (error) { console.error('Delete live session error:', error); res.status(500).json({ success: false, message: 'Failed to delete live session' }); }
};
