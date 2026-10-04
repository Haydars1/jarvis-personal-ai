import { describe, expect, it } from 'vitest';
import type { AccessTokenVerifier } from './access';
import { requireAdmin } from './access';

const env = {
  ACCESS_TEAM_DOMAIN: 'https://example.cloudflareaccess.com',
  ACCESS_AUD: 'aud-123',
  ADMIN_EMAIL: 'owner@example.test',
} as never;

const validVerifier: AccessTokenVerifier = {
  async verify() {
    return { email: 'owner@example.test', sub: 'user-1' };
  },
};

describe('Cloudflare Access admin authorization', () => {
  it('rejects public email headers when no verified Access JWT exists', async () => {
    const request = new Request('https://api.example.test/api/admin/conversations', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'owner@example.test' },
    });

    await expect(requireAdmin(request, env, validVerifier)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects invalid Access assertions', async () => {
    const verifier: AccessTokenVerifier = { async verify() { return null; } };
    const request = new Request('https://api.example.test/api/admin/conversations', {
      headers: { 'Cf-Access-Jwt-Assertion': 'invalid.jwt.value' },
    });

    await expect(requireAdmin(request, env, verifier)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a valid Access user who is not the configured owner', async () => {
    const verifier: AccessTokenVerifier = {
      async verify() { return { email: 'other@example.test', sub: 'user-2' }; },
    };
    const request = new Request('https://api.example.test/api/admin/conversations', {
      headers: { 'Cf-Access-Jwt-Assertion': 'signed.jwt.value' },
    });

    await expect(requireAdmin(request, env, verifier)).rejects.toMatchObject({ status: 403 });
  });

  it('returns the verified configured owner identity', async () => {
    const request = new Request('https://api.example.test/api/admin/conversations', {
      headers: { 'Cf-Access-Jwt-Assertion': 'signed.jwt.value' },
    });

    await expect(requireAdmin(request, env, validVerifier)).resolves.toEqual({
      email: 'owner@example.test', sub: 'user-1',
    });
  });
});
