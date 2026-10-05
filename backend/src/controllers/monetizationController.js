import prisma from '../config/database.js';

// These are intentionally local app rules; no payment provider or external charge is required.
export const MONETIZATION_REQUIREMENTS = {
  minFollowers: 1000,
  minPosts: 10,
};

const getEligibility = (followersCount, postsCount) =>
  followersCount >= MONETIZATION_REQUIREMENTS.minFollowers &&
  postsCount >= MONETIZATION_REQUIREMENTS.minPosts;

export const getMonetizationStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        monetizationStatus: true,
        monetizationAppliedAt: true,
        monetizationApprovedAt: true,
        earnings: true,
        _count: { select: { followers: true, posts: true } },
      },
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const eligible = getEligibility(user._count.followers, user._count.posts);

    // Never overwrite a submitted/approved application. Before applying, expose
    // the live eligibility state so the button can be disabled/enabled correctly.
    const status = ['pending', 'approved'].includes(user.monetizationStatus)
      ? user.monetizationStatus
      : eligible ? 'eligible' : 'not_eligible';

    res.json({
      success: true,
      data: {
        status,
        active: user.monetizationStatus === 'approved',
        eligible,
        requirements: MONETIZATION_REQUIREMENTS,
        followers: user._count.followers,
        posts: user._count.posts,
        earnings: user.earnings,
        appliedAt: user.monetizationAppliedAt,
        approvedAt: user.monetizationApprovedAt,
      },
    });
  } catch (error) {
    console.error('Get monetization status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monetization status' });
  }
};

export const applyForMonetization = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        monetizationStatus: true,
        _count: { select: { followers: true, posts: true } },
      },
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.monetizationStatus === 'pending') {
      return res.status(409).json({ success: false, message: 'Monetization application is already pending' });
    }
    if (user.monetizationStatus === 'approved') {
      return res.status(409).json({ success: false, message: 'Monetization is already active' });
    }

    const eligible = getEligibility(user._count.followers, user._count.posts);
    if (!eligible) {
      return res.status(403).json({
        success: false,
        message: `You are not eligible yet. You need at least ${MONETIZATION_REQUIREMENTS.minFollowers} followers and ${MONETIZATION_REQUIREMENTS.minPosts} posts.`,
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        monetizationStatus: 'pending',
        monetizationAppliedAt: new Date(),
      },
      select: { monetizationStatus: true, monetizationAppliedAt: true },
    });

    res.json({
      success: true,
      message: 'Monetization application submitted successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Apply monetization error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit monetization application' });
  }
};


const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const getMonetizationAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [user, ledger, payouts, posts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.userId },
        select: { earnings: true, monetizationStatus: true },
      }),
      prisma.creatorEarning.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'asc' },
        take: 2000,
        select: { id: true, amount: true, currency: true, source: true, description: true, postId: true, createdAt: true },
      }),
      prisma.payout.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: { amount: true, status: true, createdAt: true, paidAt: true },
      }),
      prisma.post.findMany({
        where: { userId: req.userId, status: 'approved' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, content: true, mediaType: true, viewCount: true, createdAt: true, likes: { select: { id: true } }, comments: { select: { id: true } } },
      }),
    ]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const periodLedger = ledger.filter((e) => new Date(e.createdAt) >= since);
    const periodEarnings = periodLedger.reduce((sum, e) => sum + e.amount, 0);
    const sourceMap = new Map();
    for (const e of periodLedger) sourceMap.set(e.source, (sourceMap.get(e.source) || 0) + e.amount);

    const monthlyMap = new Map();
    for (const e of ledger) {
      const d = new Date(e.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + e.amount);
    }
    const monthly = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, amount]) => ({ month, amount: roundMoney(amount) }));

    const pending = payouts.filter((p) => ['pending', 'approved'].includes(p.status)).reduce((sum, p) => sum + p.amount, 0);
    const paidOut = payouts.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const available = Math.max(0, user.earnings - pending);

    const topPosts = posts
      .map((p) => ({ id: p.id, content: p.content || 'Untitled post', mediaType: p.mediaType || 'text', views: p.viewCount || 0, likes: p.likes.length, comments: p.comments.length, engagement: (p.likes.length + p.comments.length), createdAt: p.createdAt }))
      .sort((a, b) => (b.views + b.engagement * 10) - (a.views + a.engagement * 10))
      .slice(0, 10);

    res.json({ success: true, data: {
      monetizationStatus: user.monetizationStatus,
      currency: 'USD',
      lifetimeEarnings: roundMoney(user.earnings),
      trackedLedgerEarnings: roundMoney(ledger.reduce((sum, e) => sum + e.amount, 0)),
      periodEarnings: roundMoney(periodEarnings),
      pendingPayouts: roundMoney(pending),
      paidOut: roundMoney(paidOut),
      availableBalance: roundMoney(available),
      periodDays: days,
      sourceBreakdown: [...sourceMap.entries()].map(([source, amount]) => ({ source, amount: roundMoney(amount) })).sort((a, b) => b.amount - a.amount),
      monthly,
      recentEarnings: periodLedger.slice(-20).reverse().map((e) => ({ ...e, amount: roundMoney(e.amount) })),
      topPosts,
    }});
  } catch (error) {
    console.error('Get monetization analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monetization analytics' });
  }
};
