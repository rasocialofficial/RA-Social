import prisma from '../config/database.js';

export const getHashtag = async (req, res) => {
  try {
    const raw = String(req.params.name || '').trim().replace(/^#/, '').toLowerCase();
    if (!raw) return res.status(400).json({ success: false, message: 'Hashtag name is required' });

    const hashtag = await prisma.hashtag.findUnique({
      where: { name: raw },
      include: {
        posts: {
          where: { post: { status: 'approved' } },
          include: {
            post: {
              include: {
                user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
                likes: { select: { id: true } },
                comments: { select: { id: true } },
                hashtags: { include: { hashtag: { select: { name: true } } } }
              }
            }
          }
        }
      }
    });

    if (!hashtag) {
      return res.json({ success: true, data: { hashtag: { name: raw, postsCount: 0 }, posts: [] } });
    }

    const posts = hashtag.posts
      .map(({ post }) => ({
        ...post,
        likesCount: post.likes.length,
        commentsCount: post.comments.length,
        hashtags: post.hashtags.map(h => h.hashtag.name)
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: { hashtag: { id: hashtag.id, name: hashtag.name, postsCount: posts.length }, posts }
    });
  } catch (error) {
    console.error('Hashtag page error:', error);
    res.status(500).json({ success: false, message: 'Failed to load hashtag' });
  }
};
