import { describe, expect, it } from 'vitest';
import worker from './index';

const env = {
  ALLOWED_ORIGIN: 'https://6006-performance.example',
};

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
};

describe('6006 Worker bootstrap', () => {
  it('serves a JSON health endpoint', async () => {
    const response = await worker.fetch(
      new Request('https://api.example.test/api/health'),
      env as never,
      ctx as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: '6006-api' });
  });

  it('rejects disallowed origins before public API routing', async () => {
    const response = await worker.fetch(
      new Request('https://api.example.test/api/unknown', {
        headers: { Origin: 'https://evil.example' },
      }),
      env as never,
      ctx as never,
    );

    expect(response.status).toBe(403);
  });

  it('adds CORS headers for the configured origin', async () => {
    const response = await worker.fetch(
      new Request('https://api.example.test/api/unknown', {
        headers: { Origin: 'https://6006-performance.example' },
      }),
      env as never,
      ctx as never,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://6006-performance.example');
    expect(response.headers.get('vary')).toContain('Origin');
  });
});
