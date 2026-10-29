import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getCachedPermissionNames,
  storeCachedPermissionNames,
} from '../providers/redis/permission-cache.provider';
import { UserRepository } from '../repositories';
import { AuthorizationService } from './authorization.service';

jest.mock('../providers/redis/permission-cache.provider', () => ({
  getCachedPermissionNames: jest.fn(),
  storeCachedPermissionNames: jest.fn(),
  invalidateCachedPermissionNames: jest.fn(),
}));

describe('AuthorizationService permission cache', () => {
  const getPermissionNames = jest.fn<(...args: any[]) => Promise<string[]>>();
  const users = { getPermissionNames } as unknown as UserRepository;
  let authorization: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getCachedPermissionNames).mockResolvedValue(null);
    jest.mocked(storeCachedPermissionNames).mockResolvedValue(undefined);
    getPermissionNames.mockResolvedValue(['department:read']);
    authorization = new AuthorizationService(users);
  });

  it('checks cached permissions without querying PostgreSQL', async () => {
    jest.mocked(getCachedPermissionNames).mockResolvedValue(['department:read']);

    await expect(authorization.hasPermission('user-id', 'department:read')).resolves.toBe(true);

    expect(getPermissionNames).not.toHaveBeenCalled();
  });

  it('loads permissions from PostgreSQL and caches them on a miss', async () => {
    await expect(authorization.hasPermission('user-id', 'department:read')).resolves.toBe(true);

    expect(getPermissionNames).toHaveBeenCalledWith('user-id');
    expect(storeCachedPermissionNames).toHaveBeenCalledWith('user-id', ['department:read']);
  });
});