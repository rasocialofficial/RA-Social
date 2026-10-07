import prisma from '../config/database.js';

export const getPublicUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, fullName: true, bio: true, avatarUrl: true, createdAt: true,
        _count: { select: { followers: true, following: true, posts: { where: { status: 'approved' } } } },
        posts: { where: { status: 'approved' }, orderBy: { createdAt: 'desc' }, take: 30, select: {
          id: true, content: true, mediaUrl: true, mediaType: true,
          createdAt: true, viewCount: true,
          likes: { select: { id: true } },
          _count: { select: { comments: true } }
        } }
      }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { _count, ...rest } = user;
    res.json({ success: true, data: {
      ...rest,
      postsCount: _count.posts,
      followersCount: _count.followers,
      followingCount: _count.following,
      posts: rest.posts.map(p => ({ ...p, likesCount: p.likes.length, commentsCount: p._count.comments, likes: undefined }))
    }});
  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};
