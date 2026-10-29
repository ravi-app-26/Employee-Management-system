import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RefreshToken } from '../entities';
import { parseSessionCacheExpiryKey, refreshTokenKey, sessionKey } from '../providers/redis/session-cache.keys';
import {
  markExpiryEventProcessed,
  storeRefreshToken,
} from '../providers/redis/refresh-token-cache.provider';
import { storeSessionId } from '../providers/redis/session-cache.provider';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { SessionExpiryEventService } from './session-expiry-event.service';

jest.mock('../providers/redis/refresh-token-cache.provider', () => ({
  markExpiryEventProcessed: jest.fn(),
  storeRefreshToken: jest.fn(),
}));
jest.mock('../providers/redis/session-cache.provider', () => ({
  storeSessionId: jest.fn(),
}));

const familyId = 'd9428888-122b-4b20-9e2a-63e4c4a99b7e';
const token = Object.assign(new RefreshToken(), {
  id: 'token-record-id',
  userId: 'user-id',
  familyId,
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
});

const repository = {
  findTokenByHash: jest.fn<(...args: [string]) => Promise<RefreshToken | null>>(),
  findFamilyTokens: jest.fn<(...args: [string]) => Promise<RefreshToken[]>>(),
  findActiveFamilyTokens: jest.fn<(...args: [string]) => Promise<RefreshToken[]>>(),
  findExpiredFamilyOwner: jest.fn<(...args: [string]) => Promise<{ userId: string; tokenId: string } | null>>(),
  recordSessionExpired: jest.fn<(...args: [string, string, string]) => Promise<void>>(),
  findStaleSessionFamilyIds: jest.fn<(...args: [string?, number?]) => Promise<string[]>>(),
  cleanupFamilyCache: jest.fn<(...args: [string]) => Promise<void>>(),
  cleanupTokenCache: jest.fn<(...args: [string, string]) => Promise<void>>(),
};

describe('SessionExpiryEventService', () => {
  let service: SessionExpiryEventService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(markExpiryEventProcessed).mockResolvedValue(true);
    jest.mocked(storeSessionId).mockResolvedValue(undefined);
    jest.mocked(storeRefreshToken).mockResolvedValue(undefined);
    repository.findTokenByHash.mockResolvedValue(token);
    repository.findFamilyTokens.mockResolvedValue([token]);
    repository.findActiveFamilyTokens.mockResolvedValue([]);
    repository.findExpiredFamilyOwner.mockResolvedValue(null);
    repository.recordSessionExpired.mockResolvedValue(undefined);
    repository.findStaleSessionFamilyIds.mockResolvedValue([]);
    repository.cleanupFamilyCache.mockResolvedValue(undefined);
    repository.cleanupTokenCache.mockResolvedValue(undefined);
    service = new SessionExpiryEventService(repository as unknown as RefreshTokenRepository);
  });

  it('parses only recognized, namespaced session/token metadata keys', () => {
    expect(parseSessionCacheExpiryKey(sessionKey(familyId))).toEqual({ type: 'session', familyId });
    expect(parseSessionCacheExpiryKey('department:list:version')).toBeNull();
  });

  it('ignores duplicate expiry notifications without repeating cleanup', async () => {
    jest.mocked(markExpiryEventProcessed).mockResolvedValue(false);

    await service.handleExpiredKey(sessionKey(familyId));

    expect(repository.findActiveFamilyTokens).not.toHaveBeenCalled();
    expect(repository.cleanupFamilyCache).not.toHaveBeenCalled();
  });

  it('restores a marker from PostgreSQL when an expired event belongs to an active family', async () => {
    repository.findActiveFamilyTokens.mockResolvedValue([token]);

    await service.handleExpiredKey(sessionKey(familyId));

    expect(storeSessionId).toHaveBeenCalledWith(familyId, token.expiresAt);
    expect(storeRefreshToken).toHaveBeenCalledWith(token);
    expect(repository.cleanupFamilyCache).not.toHaveBeenCalled();
  });

  it('cleans Redis metadata for an inactive family after its marker expires', async () => {
    await service.handleExpiredKey(sessionKey(familyId));

    expect(repository.cleanupFamilyCache).toHaveBeenCalledWith(familyId);
  });

  it('cleans an expired refresh-token record and keeps active family state', async () => {
    repository.findActiveFamilyTokens.mockResolvedValue([token]);
    const expiredKey = refreshTokenKey(token.tokenHash);

    await service.handleExpiredKey(expiredKey);

    expect(repository.findTokenByHash).toHaveBeenCalledWith(token.tokenHash);
    expect(repository.cleanupTokenCache).toHaveBeenCalledWith(token.tokenHash, familyId);
    expect(storeSessionId).toHaveBeenCalledWith(familyId, token.expiresAt);
  });

  it('reconciles stale PostgreSQL rows to recover missed expiry events', async () => {
    repository.findStaleSessionFamilyIds.mockResolvedValue([familyId]);

    await expect(service.reconcileStaleSessions()).resolves.toEqual({ examined: 1, families: 1 });

    expect(repository.cleanupFamilyCache).toHaveBeenCalledWith(familyId);
  });

  it('contains and logs database failures while processing an expiry event', async () => {
    repository.findActiveFamilyTokens.mockRejectedValue(new Error('database offline'));

    await expect(service.handleExpiredKey(sessionKey(familyId))).resolves.toBeUndefined();
  });
});
