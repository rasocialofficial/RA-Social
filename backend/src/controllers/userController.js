import prisma from '../config/database.js';

export const getPublicUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, fullName: true, bio: true, avatarUrl: true, createdAt: true,
        _count: { select: { followers: true, following: true, posts: true } },
        posts: { orderBy: { createdAt: 'desc' }, take: 30, select: {
          id: true, content: true, mediaUrl: true, mediaType: true, thumbnailUrl: true,
          createdAt: true, likeCount: true, viewCount: true,
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
      posts: rest.posts.map(p => ({ ...p, likesCount: p.likeCount || 0, commentsCount: p._count.comments }))
    }});
  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};
