import { z } from 'zod';
import { EMPLOYEE_SORT_FIELDS, EMPLOYMENT_STATUSES } from '../common/constants';
import { Employee } from '../entities/employee.entity';
import type { EmployeeDto } from '../interfaces';
import { paginationShape, sortOrder } from './pagination.validator';

export { EMPLOYEE_SORT_FIELDS, EMPLOYMENT_STATUSES } from '../common/constants';

export function toEmployeeDto(
  employee: Employee,
  identity: { firstName: string | null; lastName: string | null; workEmail: string | null },
): EmployeeDto {
  return {
    id: employee.id,
    firstName: identity.firstName,
    lastName: identity.lastName,
    workEmail: identity.workEmail,
    phone: employee.phone,
    departmentId: employee.departmentId,
    managerId: employee.managerId,
    jobTitle: employee.jobTitle,
    joiningDate: employee.joiningDate,
    employmentStatus: employee.employmentStatus,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

const phone = z.string().trim().regex(/^[+0-9 ()-]{6,30}$/, 'Invalid phone number');

export const createEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    workEmail: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(72).optional(),
    phone: phone.optional(),
    departmentId: z.string().uuid(),
    managerId: z.string().uuid().optional(),
    jobTitle: z.string().trim().min(1).max(100),
    joiningDate: isoDate.optional(),
  })
  .strict();

export const updateEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    workEmail: z.string().trim().toLowerCase().email().max(255),
    phone: phone.nullable(),
    departmentId: z.string().uuid(),
    managerId: z.string().uuid().nullable(),
    jobTitle: z.string().trim().min(1).max(100),
    joiningDate: isoDate,
    employmentStatus: z.enum(EMPLOYMENT_STATUSES),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const updateTeamMemberSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: phone.nullable(),
    jobTitle: z.string().trim().min(1).max(100),
    joiningDate: isoDate,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const updateOwnEmployeeProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: phone.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
export type UpdateOwnEmployeeProfileInput = z.infer<typeof updateOwnEmployeeProfileSchema>;

export const listEmployeesQuerySchema = z
  .object({
    ...paginationShape,
    departmentId: z.string().uuid().optional(),
    status: z.enum(EMPLOYMENT_STATUSES).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z.enum(EMPLOYEE_SORT_FIELDS).default('createdAt'),
    order: sortOrder,
  })
  .strict();

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;