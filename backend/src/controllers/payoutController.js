import prisma from '../config/database.js';

const MIN_PAYOUT = 10;
const METHODS = new Set(['bank', 'upi', 'paypal']);

export const getPayouts = async (req, res) => {
  try {
    const payouts = await prisma.payout.findMany({
      where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    res.json({ success: true, data: payouts });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payout history' });
  }
};

export const requestPayout = async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || '').toLowerCase();
    const accountLabel = String(req.body?.accountLabel || '').trim().slice(0, 120);

    if (!Number.isFinite(amount) || amount < MIN_PAYOUT) {
      return res.status(400).json({ success: false, message: `Minimum payout is ${MIN_PAYOUT}` });
    }
    if (!METHODS.has(method)) {
      return res.status(400).json({ success: false, message: 'Payout method must be bank, upi or paypal' });
    }
    if (!accountLabel) {
      return res.status(400).json({ success: false, message: 'A payout account label is required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.userId }, select: { earnings: true, monetizationStatus: true } });
      if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      if (user.monetizationStatus !== 'approved') throw Object.assign(new Error('Monetization is not active'), { statusCode: 403 });

      const reservedAgg = await tx.payout.aggregate({
        where: { userId: req.userId, status: { in: ['pending', 'approved'] } },
        _sum: { amount: true }
      });
      const reserved = reservedAgg._sum.amount || 0;
      const available = Math.max(0, user.earnings - reserved);
      if (amount > available) throw Object.assign(new Error(`Insufficient available balance. Available: ${available.toFixed(2)}`), { statusCode: 400 });

      return tx.payout.create({ data: { userId: req.userId, amount, method, accountLabel, currency: 'USD' } });
    });

    res.status(201).json({ success: true, message: 'Payout request submitted', data: result });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to request payout' });
  }
};
