import prisma from '../config/database.js';
import { cloudinary } from '../config/cloudinary.js';

const ACTIVE_WHERE = { expiresAt: { gt: new Date() }, status: 'active' };

const deleteCloudinaryAsset = async (vibe) => {
  if (!vibe?.publicId) return;
  try {
    await cloudinary.uploader.destroy(vibe.publicId, {
      resource_type: vibe.resourceType || (vibe.mediaType === 'video' ? 'video' : 'image'),
      type: 'upload'
    });
  } catch (error) {
    console.warn('Vibe media cleanup skipped:', error.message);
  }
};

export const cleanupExpiredVibes = async () => {
  const expired = await prisma.vibe.findMany({ where: { expiresAt: { lte: new Date() } }, select: { id: true, publicId: true, resourceType: true, mediaType: true } });
  if (!expired.length) return 0;
  await prisma.vibe.deleteMany({ where: { id: { in: expired.map(v => v.id) } } });
  await Promise.allSettled(expired.map(deleteCloudinaryAsset));
  return expired.length;
};

export const getVibes = async (req, res) => {
  try {
    await cleanupExpiredVibes();
    const vibes = await prisma.vibe.findMany({
      where: ACTIVE_WHERE,
      include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: vibes });
  } catch (error) {
    console.error('Get vibes error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch Vibes' });
  }
};

export const createVibe = async (req, res) => {
  try {
    const { mediaUrl, mediaType, caption, publicId, resourceType } = req.body;
    if (!mediaUrl) return res.status(400).json({ success: false, message: 'Photo or video is required' });
    if (!['image', 'video'].includes(mediaType)) return res.status(400).json({ success: false, message: 'Vibe must be an image or video' });

    await cleanupExpiredVibes();
    const vibe = await prisma.vibe.create({
      data: {
        userId: req.userId,
        mediaUrl,
        mediaType,
        caption: String(caption || '').trim().slice(0, 300) || null,
        publicId: publicId || null,
        resourceType: resourceType || (mediaType === 'video' ? 'video' : 'image'),
        status: 'active',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } }
    });
    res.status(201).json({ success: true, data: vibe });
  } catch (error) {
    console.error('Create vibe error:', error);
    res.status(500).json({ success: false, message: 'Failed to create Vibe' });
  }
};

export const deleteVibe = async (req, res) => {
  try {
    const vibe = await prisma.vibe.findUnique({ where: { id: req.params.id } });
    if (!vibe) return res.status(404).json({ success: false, message: 'Vibe not found' });
    if (vibe.userId !== req.userId) return res.status(403).json({ success: false, message: 'Not authorized' });
    await prisma.vibe.delete({ where: { id: vibe.id } });
    await deleteCloudinaryAsset(vibe);
    res.json({ success: true, message: 'Vibe deleted' });
  } catch (error) {
    console.error('Delete vibe error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete Vibe' });
  }
};
