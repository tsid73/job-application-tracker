export function createRequestGuard({ config }) {
  const rateLimitStore = new Map();

  return function enforceRequestGuards(req, url) {
    const contentLength = Number(req.headers['content-length'] || 0);
    const pathname = url.pathname;

    if (!Number.isNaN(contentLength) && contentLength > maxAllowedBodyBytes(pathname, config)) {
      const error = new Error('Request body too large for this endpoint');
      error.statusCode = 413;
      throw error;
    }

    const limit = resolveRateLimit(pathname, config);
    if (!limit) return;

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim();
    const bucketKey = `${limit.name}:${ip}`;
    const now = Date.now();
    const current = rateLimitStore.get(bucketKey);

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(bucketKey, { count: 1, resetAt: now + limit.windowMs });
      return;
    }

    if (current.count >= limit.max) {
      const error = new Error(`Rate limit exceeded for ${limit.name.replaceAll('_', ' ')}`);
      error.statusCode = 429;
      throw error;
    }

    current.count += 1;
  };
}

function resolveRateLimit(pathname, config) {
  if (pathname.startsWith('/api/ai/')) {
    return { name: 'ai_requests', windowMs: config.aiRateLimitWindowMs, max: config.aiRateLimitMax };
  }
  if (pathname === '/api/cv' || pathname === '/api/applications' || pathname === '/api/import/applications' || pathname === '/api/import/backup') {
    return { name: 'uploads', windowMs: config.uploadRateLimitWindowMs, max: config.uploadRateLimitMax };
  }
  if (pathname.startsWith('/api/')) {
    return { name: 'api_requests', windowMs: config.generalRateLimitWindowMs, max: config.generalRateLimitMax };
  }
  return null;
}

function maxAllowedBodyBytes(pathname, config) {
  if (pathname.startsWith('/api/ai/')) return config.maxAiBytes;
  if (pathname === '/api/cv' || pathname === '/api/applications') return config.maxUploadBytes + 1024 * 1024;
  if (pathname === '/api/import/applications') return config.maxUploadBytes + 1024 * 1024;
  if (pathname === '/api/import/backup') return config.maxUploadBytes * 20 + 1024 * 1024;
  if (pathname.startsWith('/api/')) return config.maxJsonBytes;
  return Number.MAX_SAFE_INTEGER;
}
