import { DataSource, IsNull } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Employee } from '../entities/employee.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { toEmployeeDto } from '../dto/employee.dto';
import { NotFoundError } from '../errors/app-error';
import { writeAuditLog } from '../utils/write-audit-log';

export class UserService {
  constructor(private readonly dataSource: DataSource) {}

  async assignRole(
    actorUserId: string,
    targetUserId: string,
    roleName: string,
    requestId: string,
  ) {
    return this.dataSource.manager.transaction(async (manager) => {
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

      await manager.update(
        RefreshToken,
        { userId: targetUserId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await writeAuditLog(manager, {
        actorUserId,
        action: 'session.revoke_any',
        resourceType: 'user',
        resourceId: targetUserId,
        requestId,
      });
    });
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