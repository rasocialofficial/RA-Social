import prisma from '../config/database.js';
import { cloudinary } from '../config/cloudinary.js';

export const createPost = async (req, res) => {
  try {
    const { content, mediaUrl, mediaType, hashtags, isCreatorAd } = req.body;
    const userId = req.userId;

    if (!content && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Content or media is required' });
    }

    const normalizedHashtags = [...new Set((Array.isArray(hashtags) ? hashtags : [])
      .map(tag => String(tag).trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean))];

    let creatorAd = Boolean(isCreatorAd);
    if (creatorAd) {
      const creator = await prisma.user.findUnique({ where: { id: userId }, select: { channelNumber: true, channelName: true } });
      if (!creator?.channelNumber) {
        return res.status(403).json({ success: false, message: 'Create your creator channel before posting a Creator Ad' });
      }
    }

    const post = await prisma.post.create({
      data: { userId, content: content?.trim() || null, mediaUrl: mediaUrl || null, mediaType: mediaType || 'text', isCreatorAd: creatorAd, status: creatorAd ? 'pending' : 'approved' },
      include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } }
    });

    if (normalizedHashtags.length > 0) {
      for (const tagName of normalizedHashtags) {
        const hashtag = await prisma.hashtag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName }
        });
        await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } });
      }
    }

    res.status(201).json({ success: true, message: 'Post created successfully', data: post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
};


export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, mediaUrl, mediaType, isCreatorAd } = req.body || {};
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Post not found' });
    if (existing.userId !== req.userId) return res.status(403).json({ success: false, message: 'Not authorized to edit this post' });

    if (Boolean(isCreatorAd)) {
      const creator = await prisma.user.findUnique({ where: { id: req.userId }, select: { channelNumber: true } });
      if (!creator?.channelNumber) return res.status(403).json({ success: false, message: 'Create your creator channel before editing a Creator Ad' });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        content: content?.trim() || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || 'text',
        isCreatorAd: Boolean(isCreatorAd),
        ...(Boolean(isCreatorAd) ? { status: 'pending' } : { status: existing.status }),
      },
      include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } }
    });
    res.json({ success: true, message: 'Post updated successfully', data: updated });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
};


export const getMyCreatorAds = async (req, res) => {
  try {
    const ads = await prisma.post.findMany({
      where: { userId: req.userId, isCreatorAd: true },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        likes: { select: { id: true } },
        comments: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: ads.map((ad) => ({ ...ad, likesCount: ad.likes.length, commentsCount: ad.comments.length })) });
  } catch (error) {
    console.error('Get creator ads error:', error);
    res.status(500).json({ success: false, message: 'Failed to load Creator Ads' });
  }
};

export const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      where: { status: 'approved' },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        likes: { select: { id: true } },
        comments: { select: { id: true } },
        hashtags: { include: { hashtag: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const formattedPosts = posts.map(post => ({
      ...post,
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      hashtags: post.hashtags.map(h => h.hashtag.name)
    }));

    res.json({ success: true, data: formattedPosts, pagination: { page: parseInt(page), limit: parseInt(limit), total: posts.length } });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feed' });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        likes: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
        comments: { include: { user: { select: { id: true, username: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' } },
        hashtags: { include: { hashtag: { select: { name: true } } } }
      }
    });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({
      success: true,
      data: { ...post, likesCount: post.likes.length, commentsCount: post.comments.length, hashtags: post.hashtags.map(h => h.hashtag.name) }
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    if (post.mediaUrl) {
      const publicId = post.mediaUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    await prisma.post.delete({ where: { id } });

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
};

export const hidePost = async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.userId !== req.userId) return res.status(403).json({ success: false, message: 'Not authorized' });
    const nextStatus = post.status === 'hidden' ? 'approved' : 'hidden';
    const updated = await prisma.post.update({ where: { id: post.id }, data: { status: nextStatus } });
    res.json({ success: true, data: { hidden: nextStatus === 'hidden' }, message: nextStatus === 'hidden' ? 'Post hidden' : 'Post restored' });
  } catch (error) {
    console.error('Hide post error:', error);
    res.status(500).json({ success: false, message: 'Failed to update post visibility' });
  }
};

export const likePost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.userId;

    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      res.json({ success: true, message: 'Post unliked', data: { liked: false } });
    } else {
      await prisma.like.create({ data: { userId, postId } });

      const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
      if (post.userId !== userId) {
        await prisma.notification.create({
          data: { receiverId: post.userId, senderId: userId, type: 'like', postId, message: 'liked your post' }
        });
      }

      res.json({ success: true, message: 'Post liked', data: { liked: true } });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Failed to like post' });
  }
};

export const addComment = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const comment = await prisma.comment.create({
      data: { userId, postId, content },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } }
    });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (post.userId !== userId) {
      await prisma.notification.create({
        data: { receiverId: post.userId, senderId: userId, type: 'comment', postId, message: 'commented on your post' }
      });
    }

    res.status(201).json({ success: true, message: 'Comment added', data: comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};

export const viewPost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.userId;

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const existing = await prisma.postView.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (!existing) {
      await prisma.$transaction([
        prisma.postView.create({ data: { userId, postId } }),
        prisma.post.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } })
      ]);
    } else {
      // PostView is also the user's watch-history record. Keep one row per
      // post/user while moving it to the latest watch time.
      await prisma.postView.update({ where: { id: existing.id }, data: { createdAt: new Date() } });
    }

    const updated = await prisma.post.findUnique({ where: { id: postId }, select: { viewCount: true } });
    res.json({ success: true, data: { viewCount: updated?.viewCount || 0, counted: !existing, watchedAt: new Date().toISOString() } });
  } catch (error) {
    console.error('View post error:', error);
    res.status(500).json({ success: false, message: 'Failed to record view' });
  }
};


export const reportPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const reason = String(req.body?.reason || 'other').trim().slice(0, 200);
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    const existing = await prisma.report.findUnique({ where: { reporterId_postId: { reporterId: req.userId, postId } } });
    if (existing) return res.status(409).json({ success: false, message: 'You have already reported this post' });
    const report = await prisma.report.create({ data: { reporterId: req.userId, postId, reason: reason || 'other' } });
    res.status(201).json({ success: true, message: 'Report submitted', data: report });
  } catch (error) {
    console.error('Report post error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
};
