import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Employee } from '../entities/employee.entity';
import { Role } from '../entities/role.entity';
import { writeAuditLog } from '../utils/write-audit-log';

export class UserRepository {
  private readonly repo: Repository<User>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(User);
  }

  // Login ke liye: passwordHash chahiye, isliye addSelect se explicitly maanga
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  // Normal use: passwordHash nahi aata (select: false)
  findById(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: { role: true },
    });
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.id = :id', { id })
      .getOne();
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id }, { passwordHash });
  }

  // Role ke saath uski permissions bhi (requirePermission ke liye)
  findByIdWithPermissions(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: { role: { permissions: true } },
    });
  }

    // User ki role-permissions ke naam, ek simple string array me
  async getPermissionNames(userId: string): Promise<string[]> {
    const user = await this.repo.findOne({
      where: { id: userId },
      relations: { role: { permissions: true } },
    });
    return user?.role.permissions.map((p) => p.name) ?? [];
  }

  // Token valid hone par bhi check: user abhi active hai ya nahi
  async isActive(userId: string): Promise<boolean> {
    const user = await this.repo.findOne({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    return !!user?.isActive;
  }

    // Employee + User ek transaction me. Koi fail ho to dono rollback.
  createEmployeeWithUser(data: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    departmentId: string;
    jobTitle: string;
    roleName: string;
    phone?: string | null;
    managerId?: string | null;
    joiningDate?: string;
      audit?: {
        actorUserId: string;
        action: string;
        resourceType: string;
        requestId: string;
      };
  }): Promise<User> {
    return this.repo.manager.transaction(async (tx) => {
      const role = await tx.findOneByOrFail(Role, { name: data.roleName });

      const employee = await tx.save(
        tx.create(Employee, {
          departmentId: data.departmentId,
          phone: data.phone ?? null,
          managerId: data.managerId ?? null,
          jobTitle: data.jobTitle,
          joiningDate: data.joiningDate ?? new Date().toISOString().slice(0, 10),
        }),
      );

      if (data.audit) {
        await writeAuditLog(tx, {
          ...data.audit,
          resourceId: employee.id,
        });
      }

      return tx.save(
        tx.create(User, {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          passwordHash: data.passwordHash,
          roleId: role.id,
          employeeId: employee.id,
        }),
      );
    });
  }

  
}