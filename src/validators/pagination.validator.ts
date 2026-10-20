import { z } from 'zod';

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
};

export const sortOrder = z.enum(['asc', 'desc']).default('asc');