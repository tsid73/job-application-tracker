const SWEEP_INTERVAL_MS = 60_000;

export function createRequestGuard({ config }) {
  const rateLimitStore = new Map();
  let nextSweepAt = Date.now() + SWEEP_INTERVAL_MS;
  let activeUploads = 0;

  return function enforceRequestGuards(req, res, url) {
    const contentLength = Number(req.headers['content-length'] || 0);
    const pathname = url.pathname;

    if (!Number.isNaN(contentLength) && contentLength > maxAllowedBodyBytes(pathname, config)) {
      const error = new Error('Request body too large for this endpoint');
      error.statusCode = 413;
      throw error;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && isUploadPath(pathname)) {
      if (activeUploads >= config.maxConcurrentUploads) {
        const error = new Error('Too many concurrent uploads. Try again in a moment.');
        error.statusCode = 429;
        throw error;
      }
      activeUploads += 1;
      res.once('close', () => {
        activeUploads = Math.max(0, activeUploads - 1);
      });
    }

    const limit = resolveRateLimit(req, pathname, config);
    if (!limit) return;

    const ip = clientAddress(req, config);
    const bucketKey = `${limit.name}:${ip}`;
    const now = Date.now();

    if (now >= nextSweepAt) {
      for (const [key, bucket] of rateLimitStore) {
        if (bucket.resetAt <= now) rateLimitStore.delete(key);
      }
      nextSweepAt = now + SWEEP_INTERVAL_MS;
    }

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

function clientAddress(req, config) {
  if (config.trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'local';
}

function isUploadPath(pathname) {
  return pathname === '/api/cv'
    || pathname === '/api/applications'
    || pathname === '/api/import/applications'
    || pathname === '/api/import/backup';
}

function resolveRateLimit(req, pathname, config) {
  if (pathname.startsWith('/api/ai/')) {
    return { name: 'ai_requests', windowMs: config.aiRateLimitWindowMs, max: config.aiRateLimitMax };
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && isUploadPath(pathname)) {
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
