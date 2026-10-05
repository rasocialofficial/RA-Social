import express from 'express';
import prisma from '../config/database.js';
import { protectAdmin } from '../middleware/adminMiddleware.js';
import { analyzeMail, generateReply } from '../services/mailAiService.js';
import { isGmailConfigured, sendGmail } from '../services/gmailService.js';

const router = express.Router();

// Google Apps Script / other trusted mail-ingestion webhook.
// It is intentionally not behind admin JWT because Gmail itself cannot send that JWT.
router.post('/inbound', async (req, res) => {
  try {
    const secret = String(req.get('x-mail-ai-secret') || '').trim();
    if (!process.env.MAIL_AI_INBOUND_SECRET || secret !== String(process.env.MAIL_AI_INBOUND_SECRET).trim()) {
      return res.status(401).json({ error: 'Invalid Mail AI inbound secret' });
    }
    const senderEmail = String(req.body?.senderEmail || '').trim();
    const receiverEmail = String(req.body?.receiverEmail || process.env.GMAIL_USER || 'rasocialofficial@gmail.com').trim();
    const subject = String(req.body?.subject || 'No subject').trim();
    const body = String(req.body?.body || '').trim();
    const externalId = String(req.body?.externalId || '').trim() || null;
    if (!senderEmail || !body) return res.status(400).json({ error: 'senderEmail and body are required' });
    if (externalId) {
      const existing = await prisma.mailAIMessage.findUnique({ where: { externalId } });
      if (existing) return res.json({ duplicate: true, message: serialize(existing) });
    }
    const analysis = analyzeMail(subject, body);
    const basic = isBasicAutoReply(analysis, subject, body);
    const replyBody = basic ? basicReply(body) : await generateReply({ senderEmail, subject, body, analysis });
    const shouldReview = !basic || analysis.phishingRisk === 'high' || analysis.spamScore >= 0.8 || analysis.urgency !== 'low';
    const message = await prisma.mailAIMessage.create({
      data: {
        ...(req.body?.userId ? { userId: String(req.body.userId) } : {}),
        senderEmail, receiverEmail, externalId, subject, body,
        status: shouldReview ? 'review' : 'pending',
        autoReply: false, replyBody,
        category: analysis.category, sentiment: analysis.sentiment, urgency: analysis.urgency,
        spamScore: analysis.spamScore, phishingRisk: analysis.phishingRisk, summary: analysis.summary,
        replies: { create: { body: replyBody, status: 'generated' } }
      }, include: { replies: { orderBy: { createdAt: 'desc' } } }
    });
    if (!shouldReview && basic && isGmailConfigured()) {
      try {
        const delivery = await sendGmail({ to: senderEmail, subject: /^re:/i.test(subject) ? subject : `Re: ${subject || 'RA Social Support'}`, text: replyBody, replyTo: process.env.GMAIL_USER || 'rasocialofficial@gmail.com' });
        const sent = await prisma.mailAIMessage.update({ where: { id: message.id }, data: { status: 'replied', autoReply: true, replies: { create: { body: replyBody, status: 'sent' } } }, include: { replies: { orderBy: { createdAt: 'desc' } } } });
        return res.status(201).json({ ...serialize(sent), delivery: 'sent', automatic: true, senderEmail: delivery.from, recipientEmail: delivery.to });
      } catch (sendError) {
        console.error('Mail AI automatic Gmail send failed:', sendError?.message || sendError);
        return res.status(201).json({ ...serialize(message), automatic: true, delivery: 'failed', warning: 'Reply was prepared but Gmail delivery failed; review and send from Admin.' });
      }
    }
    return res.status(201).json({ ...serialize(message), automatic: false, delivery: 'review' });
  } catch (e) {
    console.error('Mail AI inbound error:', e);
    res.status(500).json({ error: 'Could not ingest incoming mail' });
  }
});

router.use(protectAdmin);


const isBasicAutoReply = (analysis, subject = '', body = '') => {
  const text = `${subject} ${body}`.toLowerCase();
  const sensitive = /(payment|refund|money|billing|invoice|bank|password|otp|security|hack|account.*(locked|disabled|deleted)|delete.*account|legal|lawyer|police|complaint|abuse|harass|urgent|emergency|charge|fraud|scam|phishing)/i.test(text);
  const basic = /(^(hi|hello|hey|good morning|good afternoon|good evening)[!,. ]*$)|(thank(s| you)|thanks for|appreciate)/i.test(body.trim())
    || /(contact|support|help|how can i reach|where can i contact|is anyone there)/i.test(text);
  return Boolean(basic && !sensitive && analysis.urgency === 'low' && analysis.phishingRisk === 'low' && analysis.spamScore < 0.8);
};

const basicReply = (body = '') => {
  const text = body.toLowerCase();
  if (/thank(s| you)|appreciate/.test(text)) {
    return `Hello,\n\nYou're very welcome. Thank you for contacting RA Social.\n\nBest regards,\nRA Social Support Team`;
  }
  if (/contact|support|help|reach/.test(text)) {
    return `Hello,\n\nThank you for contacting RA Social Support. We are happy to help. Please reply with the details of your request and our team will assist you.\n\nBest regards,\nRA Social Support Team`;
  }
  return `Hello,\n\nThank you for contacting RA Social Support. We have received your message and are here to help.\n\nBest regards,\nRA Social Support Team`;
};

const serialize = (m) => ({
  id: m.id,
  senderEmail: m.senderEmail,
  receiverEmail: m.receiverEmail,
  subject: m.subject,
  body: m.body,
  status: m.status,
  autoReply: m.autoReply,
  replyBody: m.replyBody,
  category: m.category,
  sentiment: m.sentiment,
  urgency: m.urgency,
  spamScore: m.spamScore,
  phishingRisk: m.phishingRisk,
  summary: m.summary,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
  replies: m.replies || [],
});

router.get('/config', async (req, res) => {
  res.json({ senderEmail: process.env.GMAIL_USER || 'rasocialofficial@gmail.com', gmailConfigured: isGmailConfigured() });
});

router.get('/stats', async (req, res) => {
  try {
    const [incoming, replied, pending, review] = await Promise.all([
      prisma.mailAIMessage.count(),
      prisma.mailAIMessage.count({ where: { status: 'replied' } }),
      prisma.mailAIMessage.count({ where: { status: 'pending' } }),
      prisma.mailAIMessage.count({ where: { status: 'review' } }),
    ]);
    res.json({ incoming, replied, pending, review });
  } catch (e) { res.status(500).json({ error: 'Could not load Mail AI stats' }); }
});

router.get('/messages', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ senderEmail: { contains: q, mode: 'insensitive' } }, { subject: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.mailAIMessage.findMany({ where, include: { replies: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.mailAIMessage.count({ where }),
    ]);
    // Body stays a plain array (same shape as before pagination existed) so this endpoint
    // keeps working even if only one side (frontend or backend) gets redeployed first.
    // Pagination info travels via headers instead of changing the JSON shape.
    res.set('X-Total-Count', String(total));
    res.set('X-Page', String(page));
    res.set('X-Has-More', String(skip + rows.length < total));
    res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Has-More');
    res.json(rows.map(serialize));
  } catch (e) { res.status(500).json({ error: 'Could not load Mail AI messages' }); }
});

router.post('/messages', async (req, res) => {
  try {
    const senderEmail = String(req.body?.senderEmail || '').trim();
    const receiverEmail = String(req.body?.receiverEmail || '').trim();
    const subject = String(req.body?.subject || 'No subject').trim();
    const body = String(req.body?.body || '').trim();
    const autoReply = Boolean(req.body?.autoReply);
    if (!senderEmail || !receiverEmail || !body) return res.status(400).json({ error: 'senderEmail, receiverEmail and body are required' });

    const analysis = analyzeMail(subject, body);
    const basic = autoReply && isBasicAutoReply(analysis, subject, body);
    const shouldReview = analysis.phishingRisk === 'high' || analysis.spamScore >= 0.8 || !basic;
    const replyBody = autoReply ? (basic ? basicReply(body) : await generateReply({ senderEmail, subject, body, analysis })) : null;
    const message = await prisma.mailAIMessage.create({
      data: {
        userId: req.userId,
        senderEmail,
        receiverEmail,
        subject,
        body,
        status: shouldReview ? 'review' : 'pending',
        autoReply: Boolean(replyBody),
        replyBody,
        category: analysis.category,
        sentiment: analysis.sentiment,
        urgency: analysis.urgency,
        spamScore: analysis.spamScore,
        phishingRisk: analysis.phishingRisk,
        summary: analysis.summary,
        ...(replyBody ? { replies: { create: { body: replyBody, status: 'generated' } } } : {}),
      },
      include: { replies: { orderBy: { createdAt: 'desc' } } },
    });
    if (basic && replyBody && isGmailConfigured()) {
      try {
        const delivery = await sendGmail({ to: senderEmail, subject: /^re:/i.test(subject) ? subject : `Re: ${subject || 'RA Social Support'}`, text: replyBody, replyTo: process.env.GMAIL_USER || 'rasocialofficial@gmail.com' });
        const sent = await prisma.mailAIMessage.update({ where: { id: message.id }, data: { status: 'replied', autoReply: true, replies: { create: { body: replyBody, status: 'sent' } } }, include: { replies: { orderBy: { createdAt: 'desc' } } } });
        return res.status(201).json({ ...serialize(sent), delivery: 'sent', automatic: true, senderEmail: delivery.from, recipientEmail: delivery.to });
      } catch (sendError) {
        console.error('Mail AI automatic send failed:', sendError?.message || sendError);
      }
    }
    res.status(201).json(serialize(message));
  } catch (e) { console.error('Mail AI create error:', e); res.status(500).json({ error: 'Could not create Mail AI message' }); }
});

router.post('/messages/:id/generate', async (req, res) => {
  try {
    const message = await prisma.mailAIMessage.findUnique({ where: { id: req.params.id } });
    if (!message) return res.status(404).json({ error: 'Mail not found' });
    const analysis = analyzeMail(message.subject, message.body);
    const replyBody = await generateReply({ senderEmail: message.senderEmail, subject: message.subject, body: message.body, analysis });
    const updated = await prisma.mailAIMessage.update({ where: { id: message.id }, data: { category: analysis.category, sentiment: analysis.sentiment, urgency: analysis.urgency, spamScore: analysis.spamScore, phishingRisk: analysis.phishingRisk, summary: analysis.summary, replyBody, status: message.status === 'review' ? 'review' : 'pending', replies: { create: { body: replyBody, status: 'generated' } } }, include: { replies: { orderBy: { createdAt: 'desc' } } } });
    res.json(serialize(updated));
  } catch (e) { res.status(500).json({ error: 'Could not generate reply' }); }
});

router.post('/messages/:id/send', async (req, res) => {
  try {
    const message = await prisma.mailAIMessage.findUnique({ where: { id: req.params.id } });
    if (!message) return res.status(404).json({ error: 'Mail not found' });
    const replyBody = String(req.body?.replyBody || message.replyBody || '').trim();
    if (!replyBody) return res.status(400).json({ error: 'Reply body is required' });
    if (!isGmailConfigured()) return res.status(503).json({ error: 'Gmail is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD in Render Environment.' });
    const delivery = await sendGmail({
      to: message.senderEmail,
      subject: message.subject?.toLowerCase().startsWith('re:') ? message.subject : `Re: ${message.subject || 'RA Social Support'}`,
      text: replyBody,
      replyTo: process.env.GMAIL_USER || 'rasocialofficial@gmail.com'
    });
    const updated = await prisma.mailAIMessage.update({
      where: { id: message.id },
      data: {
        replyBody,
        status: 'replied',
        autoReply: true,
        replies: { create: { body: replyBody, status: 'sent' } }
      },
      include: { replies: { orderBy: { createdAt: 'desc' } } }
    });
    res.json({ ...serialize(updated), delivery: 'sent', senderEmail: delivery.from, recipientEmail: delivery.to });
  } catch (e) { res.status(500).json({ error: 'Could not send reply' }); }
});

router.patch('/messages/:id', async (req, res) => {
  try {
    const data = {};
    if (typeof req.body?.replyBody === 'string') data.replyBody = req.body.replyBody;
    if (['pending','review','replied'].includes(req.body?.status)) data.status = req.body.status;
    const updated = await prisma.mailAIMessage.update({ where: { id: req.params.id }, data, include: { replies: { orderBy: { createdAt: 'desc' } } } });
    res.json(serialize(updated));
  } catch (e) { res.status(400).json({ error: 'Could not update mail' }); }
});

router.post('/messages/bulk', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.map((id) => String(id).trim()).filter(Boolean))]
      : [];
    const action = String(req.body?.action || '').trim();
    if (!ids.length) return res.status(400).json({ error: 'Select at least one mail.' });
    if (!['reviewed', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid bulk action.' });

    if (action === 'delete') {
      await prisma.mailAIReply.deleteMany({ where: { messageId: { in: ids } } });
      const result = await prisma.mailAIMessage.deleteMany({ where: { id: { in: ids } } });
      return res.json({ success: true, action, count: result.count });
    }

    const result = await prisma.mailAIMessage.updateMany({
      where: { id: { in: ids }, status: 'review' },
      data: { status: 'pending' },
    });
    res.json({ success: true, action, count: result.count });
  } catch (e) {
    console.error('Mail AI bulk action error:', e);
    res.status(400).json({ error: 'Could not complete bulk action' });
  }
});

router.delete('/messages/:id', async (req, res) => {
  try {
    const message = await prisma.mailAIMessage.findUnique({ where: { id: req.params.id } });
    if (!message) return res.status(404).json({ error: 'Mail not found' });
    await prisma.mailAIReply.deleteMany({ where: { messageId: req.params.id } });
    await prisma.mailAIMessage.delete({ where: { id: req.params.id } });
    res.json({ success: true, id: req.params.id });
  } catch (e) { res.status(400).json({ error: 'Could not delete mail' }); }
});

export default router;
