import { z } from 'zod';
// ...existing code...
import { paginationShape, sortOrder } from './pagination.validator';

export const DEPARTMENT_SORT_FIELDS = ['name', 'createdAt'] as const;

export const listDepartmentsQuerySchema = z
  .object({
    ...paginationShape,
    sortBy: z.enum(DEPARTMENT_SORT_FIELDS).default('name'),
    order: sortOrder,
  })
  .strict();

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;
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