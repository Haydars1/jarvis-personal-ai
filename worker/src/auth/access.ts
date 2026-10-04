import type { Env } from '../env';

export interface AdminIdentity {
  email: string;
  sub: string;
}

export interface AccessTokenVerifier {
  verify(token: string, env: Env): Promise<AdminIdentity | null>;
}

export class AccessAuthError extends Error {
  constructor(public readonly status: 401 | 403 | 503, message: string) {
    super(message);
    this.name = 'AccessAuthError';
  }
}

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  email?: string;
  sub?: string;
};

type JwksResponse = {
  keys?: JsonWebKey[];
};

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    return null;
  }
}

function normalizedTeamDomain(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function audienceMatches(claim: JwtPayload['aud'], expected: string): boolean {
  if (typeof claim === 'string') return claim === expected;
  return Array.isArray(claim) && claim.includes(expected);
}

export const remoteAccessTokenVerifier: AccessTokenVerifier = {
  async verify(token, env) {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = decodeJson<JwtHeader>(parts[0]);
    const payload = decodeJson<JwtPayload>(parts[1]);
    if (!header || !payload || header.alg !== 'RS256' || !header.kid) return null;

    const issuer = normalizedTeamDomain(env.ACCESS_TEAM_DOMAIN);
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== issuer) return null;
    if (!audienceMatches(payload.aud, env.ACCESS_AUD)) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now) return null;
    if (typeof payload.email !== 'string' || !payload.email) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;

    let jwks: JwksResponse;
    try {
      const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
      if (!response.ok) return null;
      jwks = await response.json() as JwksResponse;
    } catch {
      return null;
    }

    const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid);
    if (!jwk) return null;

    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const signature = decodeBase64Url(parts[2]);
      const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
      return valid ? { email: payload.email, sub: payload.sub } : null;
    } catch {
      return null;
    }
  },
};

export async function requireAdmin(
  request: Request,
  env: Env,
  verifier: AccessTokenVerifier = remoteAccessTokenVerifier,
): Promise<AdminIdentity> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL) {
    throw new AccessAuthError(503, 'access_not_configured');
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AccessAuthError(401, 'access_assertion_missing');

  const identity = await verifier.verify(token, env);
  if (!identity) throw new AccessAuthError(401, 'access_assertion_invalid');

  if (identity.email.toLowerCase() !== env.ADMIN_EMAIL.trim().toLowerCase()) {
    throw new AccessAuthError(403, 'admin_not_allowed');
  }

  return identity;
}
