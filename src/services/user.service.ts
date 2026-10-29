import { DataSource, IsNull, MoreThan } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Employee } from '../entities/employee.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { NotFoundError } from '../errors/app-error';
import { invalidateCachedPermissionNames } from '../providers/redis/permission-cache.provider';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { writeAuditLog } from '../utils/write-audit-log';
import { insertSessionAuditEvent } from '../utils/session-audit';
import { toEmployeeDto } from '../validators';

export class UserService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async assignRole(
    actorUserId: string,
    targetUserId: string,
    roleName: string,
    requestId: string,
  ) {
    const result = await this.dataSource.manager.transaction(async (manager) => {
      const target = await manager.findOne(User, { where: { id: targetUserId } });
      if (!target) throw new NotFoundError('User not found');
      const role = await manager.findOne(Role, { where: { name: roleName } });
      if (!role) throw new NotFoundError('Role not found');

      target.roleId = role.id;
      await manager.save(User, target);
      await writeAuditLog(manager, {
        actorUserId,
        action: 'user.role.assign',
        resourceType: 'user',
        resourceId: targetUserId,
        requestId,
      });

      return { id: target.id, role: role.name };
    });

    await invalidateCachedPermissionNames(targetUserId);
    return result;
  }

  async revokeUserSessions(
    actorUserId: string,
    targetUserId: string,
    requestId: string,
  ): Promise<void> {
    await this.dataSource.manager.transaction(async (manager) => {
      const target = await manager.findOne(User, {
        where: { id: targetUserId },
        select: { id: true },
      });
      if (!target) throw new NotFoundError('User not found');

      const activeSessions = await manager.find(RefreshToken, {
        select: { id: true, familyId: true },
        where: { userId: targetUserId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      });
      await manager.update(RefreshToken, { userId: targetUserId, revokedAt: IsNull() }, { revokedAt: new Date() });
      for (const session of activeSessions) {
        await insertSessionAuditEvent(manager, {
          eventKey: `SESSION_REVOKED:${session.familyId}`,
          userId: targetUserId,
          sessionId: session.familyId,
          eventType: 'SESSION_REVOKED',
          correlationId: requestId,
        });
      }
      await writeAuditLog(manager, {
        actorUserId,
        action: 'session.revoke_any',
        resourceType: 'user',
        resourceId: targetUserId,
        requestId,
      });
    });
    await this.refreshTokens.invalidateUserCache(targetUserId);
  }

  async exportOwnProfile(userId: string, requestId: string) {
    return this.dataSource.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        relations: { role: true },
      });
      if (!user) throw new NotFoundError('User not found');
      const employee = await manager.findOne(Employee, {
        where: { id: user.employeeId },
      });
      if (!employee) throw new NotFoundError('Employee profile not found');

      await writeAuditLog(manager, {
        actorUserId: userId,
        action: 'profile.export_own',
        resourceType: 'employee',
        resourceId: employee.id,
        requestId,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role.name,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        employee: toEmployeeDto(employee, {
          firstName: user.firstName,
          lastName: user.lastName,
          workEmail: user.email,
        }),
      };
    });
  }
}