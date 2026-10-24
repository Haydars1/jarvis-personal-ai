// rate-limit.js — D1 sliding-window rate limiter for Cloudflare Workers
// Uses a single table with IP + path bucketing, auto-cleanup via TTL

export async function ensureRateLimitTable(env) {
  try {
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT NOT NULL,
      path TEXT NOT NULL,
      ts INTEGER NOT NULL,
      PRIMARY KEY (ip, path, ts)
    )`);
    await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_rl_cleanup ON rate_limits(ts)`);
  } catch {}
}

// Clean expired entries (older than windowMs)
async function cleanExpired(env, windowMs = 60000) {
  try {
    await env.DB.prepare('DELETE FROM rate_limits WHERE ts < ?')
      .bind(Date.now() - windowMs).run();
  } catch {}
}

/**
 * Check and record a request. Returns { allowed, remaining, retryAfter }
 * @param {object} env - Workers env with DB binding
 * @param {string} ip - Client IP
 * @param {string} path - Rate limit bucket (e.g. '/api/runtime/report')
 * @param {number} maxRequests - Max requests in window
 * @param {number} windowMs - Window size in ms (default 60s)
 */
export async function rateLimit(env, ip, path, maxRequests = 30, windowMs = 60000) {
  if (!env.DB) return { allowed: true, remaining: maxRequests };

  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Count recent hits
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM rate_limits WHERE ip = ? AND path = ? AND ts > ?'
    ).bind(ip, path, windowStart).first();

    const count = row?.cnt || 0;

    if (count >= maxRequests) {
      // Find oldest entry in window to calculate retry-after
      const oldest = await env.DB.prepare(
        'SELECT MIN(ts) AS earliest FROM rate_limits WHERE ip = ? AND path = ? AND ts > ?'
      ).bind(ip, path, windowStart).first();

      const retryAfter = oldest?.earliest
        ? Math.ceil((oldest.earliest + windowMs - now) / 1000)
        : Math.ceil(windowMs / 1000);

      return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
    }

    // Record this request
    await env.DB.prepare(
      'INSERT OR IGNORE INTO rate_limits (ip, path, ts) VALUES (?, ?, ?)'
    ).bind(ip, path, now).run();

    return { allowed: true, remaining: maxRequests - count - 1 };
  } catch {
    // Fail open — don't block if DB has issues
    return { allowed: true, remaining: maxRequests };
  }
}

/**
 * Get client IP from Cloudflare request
 */
export function clientIP(req) {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '0.0.0.0';
}

/**
 * Return a 429 JSON response
 */
export function rateLimitResponse(retryAfter = 60) {
  return new Response(JSON.stringify({ error: 'RATE_LIMITED', retryAfter }), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'retry-after': String(retryAfter)
    }
  });
}

// Periodic cleanup — call from cron
export async function rateLimitCleanup(env) {
  await cleanExpired(env, 120000); // Clean anything older than 2 min
}
