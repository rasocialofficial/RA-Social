const buckets = new Map();

// Small dependency-free fixed-window limiter for auth/credential endpoints.
// It is intentionally conservative and returns generic responses.
export const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 20, key = (req) => req.ip || 'unknown' } = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const id = String(key(req));
    const current = buckets.get(id);
    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(id, { startedAt: now, count: 1 });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' });
    }
    next();
  };
};

// Prevent an unbounded in-memory map on a long-running server.
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, bucket] of buckets) if (bucket.startedAt < cutoff) buckets.delete(id);
}, 10 * 60 * 1000).unref?.();
