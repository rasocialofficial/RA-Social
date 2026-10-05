import prisma from '../config/database.js';

const normalizeQuery = (value = '') => String(value).trim().replace(/^[@#]+/, '').trim();

const safeString = (value) => String(value ?? '').trim();

export const search = async (req, res) => {
  const rawQuery = safeString(req.query.query);
  const type = safeString(req.query.type || 'all').toLowerCase();

  if (!rawQuery) {
    return res.status(400).json({ success: false, message: 'Search query is required' });
  }

  const query = normalizeQuery(rawQuery);
  if (!query) {
    return res.json({ success: true, data: { users: [], posts: [], hashtags: [] }, query: rawQuery, type });
  }

  const data = { users: [], posts: [], hashtags: [] };
  const wants = (name) => type === 'all' || type === name;

  try {
    // Search users, posts and hashtags independently. This keeps one failed
    // search category from breaking the complete Search page.
    const tasks = [];

    if (wants('users')) {
      tasks.push(
        prisma.user.findMany({
          where: {
            status: { not: 'deleted' },
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { fullName: { contains: query, mode: 'insensitive' } },
              ...(query.replace(/\D/g, '').length >= 5
                ? [{ phoneNumber: { contains: query.replace(/\D/g, '') } }]
                : [])
            ]
          },
          select: { id: true, username: true, fullName: true, avatarUrl: true, bio: true },
          orderBy: { username: 'asc' },
          take: 20
        }).then(users => { data.users = users; })
      );
    }

    if (wants('posts')) {
      tasks.push(
        prisma.post.findMany({
          where: {
            status: 'approved',
            OR: [
              { content: { contains: query, mode: 'insensitive' } },
              { user: { username: { contains: query, mode: 'insensitive' } } },
              { user: { fullName: { contains: query, mode: 'insensitive' } } },
              { hashtags: { some: { hashtag: { name: { contains: query, mode: 'insensitive' } } } } }
            ]
          },
          include: {
            user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
            likes: { select: { id: true } },
            comments: { select: { id: true } },
            hashtags: { include: { hashtag: { select: { name: true } } } }
          },
          orderBy: { createdAt: 'desc' },
          take: 30
        }).then(posts => {
          data.posts = posts.map(post => ({
            ...post,
            likesCount: post.likes.length,
            commentsCount: post.comments.length,
            hashtags: post.hashtags.map(item => item.hashtag.name)
          }));
        })
      );
    }

    if (wants('hashtags')) {
      tasks.push(
        prisma.hashtag.findMany({
          where: { name: { contains: query, mode: 'insensitive' } },
          include: { posts: { select: { postId: true } } },
          orderBy: { name: 'asc' },
          take: 20
        }).then(hashtags => {
          data.hashtags = hashtags.map(tag => ({
            id: tag.id,
            name: tag.name,
            postsCount: tag.posts.length
          }));
        })
      );
    }

    const settled = await Promise.allSettled(tasks);
    const failed = settled.filter(item => item.status === 'rejected');
    if (failed.length) {
      failed.forEach(item => console.error('Search category failed:', item.reason));
    }

    return res.json({ success: true, data, query: rawQuery, type });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
};
