import { UserRepository } from '../repositories';
import {
  getCachedPermissionNames,
  storeCachedPermissionNames,
} from '../providers/redis/permission-cache.provider';

export class AuthorizationService {
  constructor(private readonly users: UserRepository) {}

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    let permissions = await getCachedPermissionNames(userId);
    if (permissions === null) {
      permissions = await this.users.getPermissionNames(userId);
      await storeCachedPermissionNames(userId, permissions);
    }
    return permissions.includes(permission);
  }

  isActive(userId: string): Promise<boolean> {
    return this.users.isActive(userId);
  }
}