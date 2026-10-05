import prisma from '../config/database.js';

const normalize = (body = {}) => ({
  name: String(body.name || '').trim(),
  type: String(body.type || 'banner').trim(),
  status: String(body.status || 'draft').trim(),
  advertiser: body.advertiser ? String(body.advertiser).trim() : null,
  targetUrl: body.targetUrl ? String(body.targetUrl).trim() : null,
  mediaUrl: body.mediaUrl ? String(body.mediaUrl).trim() : null,
  budget: Number.isFinite(Number(body.budget)) ? Number(body.budget) : 0,
  startsAt: body.startsAt ? new Date(body.startsAt) : null,
  endsAt: body.endsAt ? new Date(body.endsAt) : null,
});

export const getAds = async (req, res) => {
  try {
    const type = String(req.query.type || 'all');
    const where = type === 'all' ? {} : { type };
    const ads = await prisma.adCampaign.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(ads.map(a => ({ ...a, spent: Number(a.spent || 0), budget: Number(a.budget || 0) })));
  } catch (error) { console.error('Admin ads list error:', error); res.status(500).json({ error: 'Failed to fetch ad campaigns' }); }
};

export const createAd = async (req, res) => {
  try {
    const data = normalize(req.body);
    if (!data.name) return res.status(400).json({ error: 'Campaign name is required' });
    if (data.endsAt && data.startsAt && data.endsAt < data.startsAt) return res.status(400).json({ error: 'End date must be after start date' });
    const ad = await prisma.adCampaign.create({ data });
    res.status(201).json(ad);
  } catch (error) { console.error('Admin ad create error:', error); res.status(500).json({ error: 'Failed to create ad campaign' }); }
};

export const updateAd = async (req, res) => {
  try {
    const data = normalize(req.body);
    if (!data.name) return res.status(400).json({ error: 'Campaign name is required' });
    const ad = await prisma.adCampaign.update({ where: { id: req.params.id }, data });
    res.json(ad);
  } catch (error) { console.error('Admin ad update error:', error); res.status(500).json({ error: 'Failed to update ad campaign' }); }
};

export const deleteAd = async (req, res) => {
  try { await prisma.adCampaign.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }
  catch (error) { console.error('Admin ad delete error:', error); res.status(500).json({ error: 'Failed to delete ad campaign' }); }
};
