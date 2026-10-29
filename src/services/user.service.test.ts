import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { invalidateCachedPermissionNames } from '../providers/redis/permission-cache.provider';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { UserService } from './user.service';

jest.mock('../providers/redis/permission-cache.provider', () => ({
  getCachedPermissionNames: jest.fn(),
  storeCachedPermissionNames: jest.fn(),
  invalidateCachedPermissionNames: jest.fn(),
}));

describe('UserService role permission cache invalidation', () => {
  const target = Object.assign(new User(), { id: 'target-user', roleId: 1 });
  const role = Object.assign(new Role(), { id: 2, name: 'hr' });
  const manager = {
    findOne: jest.fn<(...args: any[]) => Promise<unknown>>(),
    save: jest.fn<(...args: any[]) => Promise<unknown>>(),
    insert: jest.fn<(...args: any[]) => Promise<unknown>>(),
  };
  const transaction = jest.fn<(...args: any[]) => Promise<unknown>>();
  const dataSource = {
    manager: { transaction },
  } as unknown as DataSource;
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(invalidateCachedPermissionNames).mockResolvedValue(undefined);
    manager.findOne.mockImplementation(async (entity: unknown) => entity === User ? target : role);
    manager.save.mockResolvedValue(target);
    manager.insert.mockResolvedValue(undefined);
    transaction.mockImplementation(async (callback: any) => callback(manager));
    service = new UserService(dataSource, { invalidateUserCache: jest.fn() } as unknown as RefreshTokenRepository);
  });

  it('invalidates the target user permission cache after role assignment commits', async () => {
    await expect(service.assignRole('admin-user', target.id, role.name, 'request-id'))
      .resolves.toEqual({ id: target.id, role: role.name });

    expect(invalidateCachedPermissionNames).toHaveBeenCalledWith(target.id);
  });
});