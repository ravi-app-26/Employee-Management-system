import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { RefreshToken } from '../entities';
import {
  deleteSessionId,
  hasSessionId,
  storeSessionId,
} from '../providers/redis/session-cache.provider';
import {
  deleteRefreshToken,
  deleteRefreshTokenFamily,
  findRefreshToken,
  storeRefreshToken,
} from '../providers/redis/refresh-token-cache.provider';
import { RefreshTokenRepository } from './refresh-token.repository';

jest.mock('../providers/redis/session-cache.provider', () => ({
  deleteSessionId: jest.fn(),
  hasSessionId: jest.fn(),
  storeSessionId: jest.fn(),
}));
jest.mock('../providers/redis/refresh-token-cache.provider', () => ({
  deleteRefreshToken: jest.fn(),
  deleteRefreshTokenFamily: jest.fn(),
  findRefreshToken: jest.fn(),
  storeRefreshToken: jest.fn(),
}));

const tokenHash = 'a'.repeat(64);
const expiresAt = new Date('2027-01-01T00:00:00.000Z');
const token = Object.assign(new RefreshToken(), {
  id: 'token-id',
  userId: 'user-id',
  familyId: 'session-id',
  tokenHash,
  expiresAt,
  revokedAt: null,
  createdAt: new Date('2026-10-27T00:00:00.000Z'),
});

const insertQueryBuilder = {
  insert: jest.fn<() => any>(),
  into: jest.fn<() => any>(),
  values: jest.fn<() => any>(),
  orIgnore: jest.fn<() => any>(),
  execute: jest.fn<() => Promise<void>>(),
};
const transactionManager = {
  create: jest.fn<() => typeof token>(),
  save: jest.fn<() => Promise<typeof token>>(),
  update: jest.fn<() => Promise<void>>(),
  createQueryBuilder: jest.fn<() => typeof insertQueryBuilder>(),
};

describe('RefreshTokenRepository session cache', () => {
  const repository = {
    create: jest.fn<(...args: any[]) => RefreshToken>(),
    find: jest.fn<(...args: any[]) => Promise<Array<{ familyId: string }>>>(),
    findOne: jest.fn<(...args: any[]) => Promise<RefreshToken | null>>(),
    save: jest.fn<(...args: any[]) => Promise<RefreshToken>>(),
    update: jest.fn<(...args: any[]) => Promise<unknown>>(),
    exists: jest.fn<(...args: any[]) => Promise<boolean>>(),
    manager: {
      transaction: jest.fn<(...args: any[]) => Promise<unknown>>(),
    },
  };
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(repository),
  } as unknown as DataSource;
  let refreshTokens: RefreshTokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    insertQueryBuilder.insert.mockReturnValue(insertQueryBuilder);
    insertQueryBuilder.into.mockReturnValue(insertQueryBuilder);
    insertQueryBuilder.values.mockReturnValue(insertQueryBuilder);
    insertQueryBuilder.orIgnore.mockReturnValue(insertQueryBuilder);
    insertQueryBuilder.execute.mockResolvedValue(undefined);
    transactionManager.create.mockReturnValue(token);
    transactionManager.save.mockResolvedValue(token);
    transactionManager.update.mockResolvedValue(undefined);
    transactionManager.createQueryBuilder.mockReturnValue(insertQueryBuilder);
    jest.mocked(hasSessionId).mockResolvedValue(false);
    jest.mocked(storeSessionId).mockResolvedValue(undefined);
    jest.mocked(deleteSessionId).mockResolvedValue(undefined);
    jest.mocked(deleteRefreshToken).mockResolvedValue(undefined);
    jest.mocked(deleteRefreshTokenFamily).mockResolvedValue(undefined);
    jest.mocked(findRefreshToken).mockResolvedValue(null);
    jest.mocked(storeRefreshToken).mockResolvedValue(undefined);
    repository.create.mockReturnValue(token);
    repository.find.mockResolvedValue([]);
    repository.save.mockResolvedValue(token);
    repository.update.mockResolvedValue(undefined);
    repository.exists.mockResolvedValue(false);
    repository.manager.transaction.mockImplementation(async (callback: any) => callback(transactionManager));
    repository.find.mockResolvedValue([token]);
    refreshTokens = new RefreshTokenRepository(dataSource);
  });

  it('stores the token in Redis after saving it in the DB', async () => {
    await refreshTokens.create({
      userId: token.userId,
      tokenHash,
      familyId: token.familyId,
      expiresAt,
    });

    expect(transactionManager.save).toHaveBeenCalled();
    expect(storeSessionId).toHaveBeenCalledWith(token.familyId, expiresAt);
    expect(storeRefreshToken).toHaveBeenCalledWith(token);
  });

  it('uses PostgreSQL as the source of truth when Redis has a stale valid token', async () => {
    jest.mocked(findRefreshToken).mockResolvedValue(token);
    const revokedToken = Object.assign(new RefreshToken(), {
      ...token,
      revokedAt: new Date(),
    });
    repository.findOne.mockResolvedValue(revokedToken);

    const result = await refreshTokens.findByHash(tokenHash);

    expect(result).toBe(revokedToken);
    expect(findRefreshToken).not.toHaveBeenCalled();
    expect(repository.findOne).toHaveBeenCalledWith({ where: { tokenHash } });
  });

  it('uses PostgreSQL and restores Redis cache after a cache miss', async () => {
    repository.findOne.mockResolvedValue(token);

    const result = await refreshTokens.findByHash(tokenHash);

    expect(result).toBe(token);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { tokenHash } });
    expect(storeRefreshToken).toHaveBeenCalledWith(token);
  });

  it('restores a missing Redis session key from a valid DB-backed token', async () => {
    await refreshTokens.ensureSession(token.familyId, expiresAt);

    expect(hasSessionId).toHaveBeenCalledWith(token.familyId);
    expect(storeSessionId).toHaveBeenCalledWith(token.familyId, expiresAt);
  });

  it('does not rewrite an existing Redis session key', async () => {
    jest.mocked(hasSessionId).mockResolvedValue(true);

    await refreshTokens.ensureSession(token.familyId, expiresAt);

    expect(storeSessionId).not.toHaveBeenCalled();
  });

  it('returns an active session expiry from PostgreSQL for a user and family', async () => {
    repository.findOne.mockResolvedValue(token);

    await expect(refreshTokens.findActiveSessionExpiry(token.userId, token.familyId))
      .resolves.toBe(token.expiresAt);

    expect(repository.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: token.userId,
        familyId: token.familyId,
      }),
    }));
  });

  it('returns no active session when PostgreSQL has no unrevoked token', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(refreshTokens.findActiveSessionExpiry(token.userId, token.familyId))
      .resolves.toBeNull();
  });

  it('deletes the session ID from Redis when its family is revoked', async () => {
    await refreshTokens.revokeFamily(token.familyId);

    expect(transactionManager.update).toHaveBeenCalled();
    expect(deleteSessionId).toHaveBeenCalledWith(token.familyId);
    expect(deleteRefreshTokenFamily).toHaveBeenCalledWith(token.familyId);
  });

  it('deletes each distinct session ID when all user sessions are revoked', async () => {
    repository.find.mockResolvedValue([
      { familyId: 'session-one' },
      { familyId: 'session-one' },
      { familyId: 'session-two' },
    ]);

    await refreshTokens.revokeAllForUser(token.userId);

    expect(deleteSessionId).toHaveBeenCalledTimes(2);
    expect(deleteSessionId).toHaveBeenCalledWith('session-one');
    expect(deleteSessionId).toHaveBeenCalledWith('session-two');
  });
});