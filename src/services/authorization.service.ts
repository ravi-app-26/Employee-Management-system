import { UserRepository } from '../repositories/user.repository';

export class AuthorizationService {
  constructor(private readonly users: UserRepository) {}

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.users.getPermissionNames(userId);
    return permissions.includes(permission);
  }

  isActive(userId: string): Promise<boolean> {
    return this.users.isActive(userId);
  }
}