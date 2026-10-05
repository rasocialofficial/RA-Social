import prisma from '../config/database.js';

const publicCampaignWhere = () => ({
  status: 'active',
  OR: [
    { startsAt: null },
    { startsAt: { lte: new Date() } },
  ],
  AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
});

export const listActiveAds = async (req, res) => {
  try {
    const type = String(req.query.type || '').trim();
    const ads = await prisma.adCampaign.findMany({
      where: { ...publicCampaignWhere(), ...(type && type !== 'all' ? { type } : {}) },
      orderBy: [{ updatedAt: 'desc' }],
      take: 20,
      select: { id:true, name:true, type:true, targetUrl:true, mediaUrl:true, advertiser:true, impressions:true, clicks:true },
    });
    res.json(ads);
  } catch (error) {
    console.error('List active ads error:', error);
    res.status(500).json({ error: 'Failed to load ads' });
  }
};

export const recordAdEvent = async (req, res) => {
  try {
    const { eventType } = req.body || {};
    if (!['impression', 'click'].includes(eventType)) return res.status(400).json({ error: 'Invalid ad event' });
    const campaign = await prisma.adCampaign.findFirst({ where: { id: req.params.id, ...publicCampaignWhere() } });
    if (!campaign) return res.status(404).json({ error: 'Ad campaign not found or inactive' });
    await prisma.$transaction([
      prisma.adEvent.create({ data: { campaignId: campaign.id, eventType, userId: req.userId || null } }),
      prisma.adCampaign.update({ where: { id: campaign.id }, data: eventType === 'click' ? { clicks: { increment: 1 } } : { impressions: { increment: 1 } } }),
    ]);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Ad event error:', error);
    res.status(500).json({ error: 'Failed to record ad event' });
  }
};
