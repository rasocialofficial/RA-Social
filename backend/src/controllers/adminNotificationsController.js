import prisma from '../config/database.js';

const parseDate = (value) => {
  const d = new Date(String(value || ''));
  return Number.isNaN(d.getTime()) ? null : d;
};

const iso = (value, fallback) => new Date(value || fallback || Date.now()).toISOString();

// GET /api/admin/notifications/counts?usersSince=<ISO date>
// Read-only. Powers the sidebar red-dot badges, the bell dropdown and the tab title count.
export const getAdminNotificationCounts = async (req, res) => {
  try {
    const usersSince = parseDate(req.query.usersSince) || new Date();
    const openMail = { status: { in: ['pending', 'review'] } };

    const [
      newUsers,
      pendingReports,
      pendingPayouts,
      pendingMonetization,
      mailRows,
      recentUsers,
      recentMail,
      recentReports,
      recentPayouts,
      recentMonetization,
    ] = await Promise.all([
      prisma.user.count({ where: { role: { not: 'admin' }, createdAt: { gt: usersSince } } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.payout.count({ where: { status: 'pending' } }),
      prisma.user.count({ where: { monetizationStatus: 'pending' } }),
      prisma.mailAIMessage.findMany({ where: openMail, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true } }),
      prisma.user.findMany({
        where: { role: { not: 'admin' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, username: true, email: true, createdAt: true },
      }),
      prisma.mailAIMessage.findMany({
        where: openMail,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, senderEmail: true, subject: true, createdAt: true },
      }),
      prisma.report.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, reason: true, createdAt: true, reporter: { select: { username: true } } },
      }),
      prisma.payout.findMany({
        where: { status: 'pending' },
        orderBy: { requestedAt: 'desc' },
        take: 5,
        select: { id: true, amount: true, currency: true, requestedAt: true, user: { select: { username: true } } },
      }),
      prisma.user.findMany({
        where: { monetizationStatus: 'pending' },
        orderBy: { monetizationAppliedAt: 'desc' },
        take: 5,
        select: { id: true, username: true, monetizationAppliedAt: true, createdAt: true },
      }),
    ]);

    const recent = [
      ...recentUsers.map((u) => ({
        type: 'user',
        id: u.id,
        title: `New user @${u.username}`,
        sub: u.email,
        href: '/users',
        at: iso(u.createdAt),
      })),
      ...recentMail.map((m) => ({
        type: 'mail',
        id: m.id,
        title: `Mail from ${m.senderEmail}`,
        sub: m.subject || 'No subject',
        href: '/mail-ai',
        at: iso(m.createdAt),
      })),
      ...recentReports.map((r) => ({
        type: 'report',
        id: r.id,
        title: `New report${r.reporter?.username ? ` by @${r.reporter.username}` : ''}`,
        sub: r.reason,
        href: '/reports',
        at: iso(r.createdAt),
      })),
      ...recentPayouts.map((p) => ({
        type: 'payout',
        id: p.id,
        title: `Payout request${p.user?.username ? ` from @${p.user.username}` : ''}`,
        sub: `${p.currency || 'USD'} ${Number(p.amount || 0).toFixed(2)}`,
        href: '/payouts',
        at: iso(p.requestedAt),
      })),
      ...recentMonetization.map((u) => ({
        type: 'monetization',
        id: u.id,
        title: `Monetization application`,
        sub: `@${u.username}`,
        href: '/monetization',
        at: iso(u.monetizationAppliedAt, u.createdAt),
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12);

    res.set('Cache-Control', 'no-store');
    res.json({
      newUsers,
      pendingReports,
      pendingPayouts,
      pendingMonetization,
      mailIds: mailRows.map((m) => m.id),
      recent,
    });
  } catch (error) {
    console.error('Admin notification counts error:', error);
    res.status(500).json({ error: 'Failed to fetch notification counts' });
  }
};
