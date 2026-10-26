import { z } from 'zod';
import { DEFAULT_LIMIT, MAX_LIMIT, SORT_ORDERS } from '../common/constants';

export { DEFAULT_LIMIT, MAX_LIMIT } from '../common/constants';

export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
};

export const sortOrder = z.enum(SORT_ORDERS).default('asc');