import { IsNull, Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { Department } from '../entities/department.entity';
import { Employee } from '../entities/employee.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-error';
import { env } from '../config/env';
import { EmployeeListFilters, EmployeeRepository } from '../repositories/employee.repository';
import { UserRepository } from '../repositories/user.repository';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  UpdateOwnEmployeeProfileInput,
} from '../validators/employee.validator';

export interface EmployeeActor {
  id: string;
  role: string;
  employeeId: string;
}

type EmployeeView = Employee & {
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
};

export class EmployeeService {
  constructor(
    private readonly employees: Repository<Employee>,
    private readonly departments: Repository<Department>,
    private readonly users: Repository<User>,
    private readonly userRepository: UserRepository,
  ) {}

  list(filters: EmployeeListFilters, actor: EmployeeActor) {
    return EmployeeRepository.list(this.employees, {
      ...filters,
      scope: { role: actor.role, employeeId: actor.employeeId },
    });
  }

  async create(input: CreateEmployeeInput): Promise<EmployeeView> {
    if (!(await this.departments.exists({ where: { id: input.departmentId } }))) {
      throw new NotFoundError('Department not found');
    }
    if (input.managerId) await this.requireEmployee(input.managerId);

    const password = input.password ?? randomBytes(32).toString('base64url');
    const user = await this.userRepository.createEmployeeWithUser({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.workEmail,
      passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
      departmentId: input.departmentId,
      managerId: input.managerId ?? null,
      phone: input.phone ?? null,
      jobTitle: input.jobTitle,
      joiningDate: input.joiningDate,
      roleName: 'employee',
    });
    return this.withIdentity(await this.requireEmployee(user.employeeId));
  }

  async getById(id: string, actor: EmployeeActor): Promise<EmployeeView> {
    const employee = await this.requireEmployee(id);
    this.ensureRecordAccess(employee, actor);
    return this.withIdentity(employee);
  }

  async update(
    id: string,
    input: UpdateEmployeeInput,
    actor: EmployeeActor,
  ): Promise<EmployeeView> {
    const employee = await this.requireEmployee(id);
    if (actor.role === 'manager' && employee.id === actor.employeeId) {
      throw new ForbiddenError('Managers must update their own profile through /me');
    }
    this.ensureRecordAccess(employee, actor);

    if (input.departmentId && !(await this.departments.exists({ where: { id: input.departmentId } }))) {
      throw new NotFoundError('Department not found');
    }
    if (input.managerId) {
      if (input.managerId === id) throw new BadRequestError('An employee cannot manage themselves');
      await this.requireEmployee(input.managerId);
    }

    const { firstName, lastName, workEmail, ...employeeFields } = input;
    Object.assign(employee, employeeFields);
    await this.employees.manager.transaction(async (manager) => {
      await manager.save(Employee, employee);
      if (firstName !== undefined || lastName !== undefined || workEmail !== undefined) {
        const user = await manager.findOneBy(User, { employeeId: id });
        if (!user) throw new BadRequestError('Employee has no login account');
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (workEmail !== undefined) user.email = workEmail;
        await manager.save(User, user);
      }
    });
    return this.withIdentity(employee);
  }

  async deactivate(id: string, actor: EmployeeActor): Promise<void> {
    const employee = await this.requireEmployee(id);
    this.ensureRecordAccess(employee, actor);

    await this.employees.manager.transaction(async (manager) => {
      employee.employmentStatus = 'inactive';
      await manager.save(Employee, employee);

      const user = await manager.findOne(User, {
        where: { employeeId: id },
        select: { id: true },
      });
      if (user) {
        await manager.update(User, { id: user.id }, { isActive: false });
        await manager.update(
          RefreshToken,
          { userId: user.id, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      }
    });
  }

  async getOwnProfile(actor: EmployeeActor): Promise<EmployeeView> {
    return this.withIdentity(await this.requireEmployee(actor.employeeId));
  }

  async updateOwnProfile(
    actor: EmployeeActor,
    input: UpdateOwnEmployeeProfileInput,
  ): Promise<EmployeeView> {
    const employee = await this.requireEmployee(actor.employeeId);
    if (input.phone !== undefined) employee.phone = input.phone;
    await this.employees.manager.transaction(async (manager) => {
      await manager.save(Employee, employee);
      const user = await manager.findOneBy(User, { employeeId: actor.employeeId });
      if (!user) throw new NotFoundError('Employee account not found');
      if (input.firstName !== undefined) user.firstName = input.firstName;
      if (input.lastName !== undefined) user.lastName = input.lastName;
      await manager.save(User, user);
    });
    return this.withIdentity(employee);
  }

  private async requireEmployee(id: string): Promise<Employee> {
    const employee = await this.employees.findOne({ where: { id } });
    if (!employee) throw new NotFoundError('Employee not found');
    return employee;
  }

  private async withIdentity(employee: Employee): Promise<EmployeeView> {
    const user = await this.users.findOneBy({ employeeId: employee.id });
    return {
      ...employee,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      workEmail: user?.email ?? null,
    };
  }

  private ensureRecordAccess(employee: Employee, actor: EmployeeActor): void {
    if (actor.role === 'admin' || actor.role === 'hr') return;
    if (
      actor.role === 'manager' &&
      (employee.id === actor.employeeId || employee.managerId === actor.employeeId)
    ) {
      return;
    }
    if (actor.role === 'employee' && employee.id === actor.employeeId) return;
    throw new NotFoundError('Employee not found');
  }
}