import prisma from '../config/database.js';

const format = (row) => ({
  id: row.id,
  createdAt: row.createdAt,
  post: row.post ? {
    ...row.post,
    likesCount: row.post.likes?.length || 0,
    commentsCount: row.post.comments?.length || 0,
  } : null,
});

export const listSavedPosts = async (req, res) => {
  try {
    const rows = await prisma.savedPost.findMany({
      where: { userId: req.userId, post: { status: 'approved' } },
      include: { post: { include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } }, likes: { select: { id: true } }, comments: { select: { id: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: rows.map(format) });
  } catch (error) {
    console.error('List saved posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to load saved posts' });
  }
};

export const savePost = async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId }, select: { id: true, status: true } });
    if (!post || post.status !== 'approved') return res.status(404).json({ success: false, message: 'Post not found' });
    const saved = await prisma.savedPost.upsert({ where: { userId_postId: { userId: req.userId, postId: post.id } }, update: {}, create: { userId: req.userId, postId: post.id } });
    res.status(201).json({ success: true, data: { saved: true, id: saved.id } });
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ success: false, message: 'Failed to save post' });
  }
};

export const unsavePost = async (req, res) => {
  try {
    await prisma.savedPost.deleteMany({ where: { userId: req.userId, postId: req.params.postId } });
    res.json({ success: true, data: { saved: false } });
  } catch (error) {
    console.error('Unsave post error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove saved post' });
  }
};

export const savedStatus = async (req, res) => {
  try {
    const row = await prisma.savedPost.findUnique({ where: { userId_postId: { userId: req.userId, postId: req.params.postId } }, select: { id: true } });
    res.json({ success: true, data: { saved: Boolean(row) } });
  } catch (error) {
    console.error('Saved status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check saved status' });
  }
};
