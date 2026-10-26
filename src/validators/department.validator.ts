import { z } from 'zod';
// ...existing code...
import { DEPARTMENT_SORT_FIELDS } from '../common/constants';
import { Department } from '../entities/department.entity';
import type { DepartmentDto } from '../interfaces';
import { paginationShape, sortOrder } from './pagination.validator';

export { DEPARTMENT_SORT_FIELDS } from '../common/constants';

export function toDepartmentDto(department: Department): DepartmentDto {
  return {
    id: department.id,
    name: department.name,
    description: department.description,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}

export const listDepartmentsQuerySchema = z
  .object({
    ...paginationShape,
    sortBy: z.enum(DEPARTMENT_SORT_FIELDS).default('name'),
    order: sortOrder,
  })
  .strict();

// ...existing code...
export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required',
  });