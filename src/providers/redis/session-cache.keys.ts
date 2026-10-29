import { env } from '../../config/env';

export type SessionCacheExpiryKey =
  | { type: 'session'; familyId: string }
  | { type: 'refresh-token'; tokenHash: string }
  | { type: 'refresh-token-family'; familyId: string };

export function sessionKey(sessionId: string): string {
  return withPrefix(env.REDIS_SESSION_KEY_PREFIX, `session:${sessionId}`);
}

export function refreshTokenKey(tokenHash: string): string {
  return withPrefix(env.REDIS_TOKEN_KEY_PREFIX, `refresh-token:${tokenHash}`);
}

export function refreshTokenFamilyKey(familyId: string): string {
  return withPrefix(env.REDIS_TOKEN_KEY_PREFIX, `refresh-token-family:${familyId}`);
}

export function expiryEventKey(fingerprint: string): string {
  return withPrefix(env.REDIS_EVENT_KEY_PREFIX, `expiry-event:${fingerprint}`);
}

export function parseSessionCacheExpiryKey(key: string): SessionCacheExpiryKey | null {
  const sessionPrefix = prefixFor(env.REDIS_SESSION_KEY_PREFIX);
  const tokenPrefix = prefixFor(env.REDIS_TOKEN_KEY_PREFIX);
  const unprefixed = key.startsWith(sessionPrefix)
    ? key.slice(sessionPrefix.length)
    : key.startsWith(tokenPrefix)
      ? key.slice(tokenPrefix.length)
      : null;
  if (unprefixed === null) return null;

  const sessionMatch = /^session:([0-9a-f-]{36})$/i.exec(unprefixed);
  if (sessionMatch) return { type: 'session', familyId: sessionMatch[1] };

  const tokenMatch = /^refresh-token:([0-9a-f]{64})$/i.exec(unprefixed);
  if (tokenMatch) return { type: 'refresh-token', tokenHash: tokenMatch[1] };

  const familyMatch = /^refresh-token-family:([0-9a-f-]{36})$/i.exec(unprefixed);
  if (familyMatch) return { type: 'refresh-token-family', familyId: familyMatch[1] };

  return null;
}

function withPrefix(namespace: string, key: string): string {
  return [env.REDIS_KEY_PREFIX, namespace, key].filter(Boolean).join(':');
}

function prefixFor(namespace: string): string {
  return [env.REDIS_KEY_PREFIX, namespace].filter(Boolean).join(':') + ':';
}
