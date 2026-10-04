import { describe, expect, it } from 'vitest';
import {
  createAdminSessionCookie,
  verifyAdminCredentials,
  verifyAdminSession,
} from './native';

const env = {
  ADMIN_EMAIL: '6006performance@gmail.com',
  ADMIN_PASSWORD_HASH: '37a92d392e3f5e918cd49434bc3cab65da32b5556e2436d7b04de98b6a27cecf',
  ADMIN_SESSION_SECRET: 'test-session-secret-with-enough-entropy',
} as never;

describe('native admin auth', () => {
  it('accepts the configured admin email/password and rejects wrong credentials', async () => {
    await expect(verifyAdminCredentials('6006performance@gmail.com', '6006-taO3gdZrmSemvQKxHE!J', env)).resolves.toBe(true);
    await expect(verifyAdminCredentials('6006performance@gmail.com', 'wrong-password', env)).resolves.toBe(false);
    await expect(verifyAdminCredentials('other@example.com', '6006-taO3gdZrmSemvQKxHE!J', env)).resolves.toBe(false);
  });

  it('creates a secure signed session cookie and verifies it', async () => {
    const cookie = await createAdminSessionCookie('6006performance@gmail.com', env, 1_700_000_000);
    expect(cookie).toContain('6006_admin_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');

    const pair = cookie.split(';', 1)[0];
    const request = new Request('https://6006-performance.example/api/admin/conversations', {
      headers: { Cookie: pair },
    });
    await expect(verifyAdminSession(request, env, 1_700_000_100)).resolves.toEqual({
      email: '6006performance@gmail.com',
      sub: 'native:6006performance@gmail.com',
    });
  });

  it('rejects a tampered or expired session', async () => {
    const cookie = await createAdminSessionCookie('6006performance@gmail.com', env, 1_700_000_000);
    const pair = cookie.split(';', 1)[0];
    const tampered = `${pair}x`;

    await expect(verifyAdminSession(new Request('https://example.test', { headers: { Cookie: tampered } }), env, 1_700_000_100)).resolves.toBeNull();
    await expect(verifyAdminSession(new Request('https://example.test', { headers: { Cookie: pair } }), env, 1_700_100_000)).resolves.toBeNull();
  });
});
