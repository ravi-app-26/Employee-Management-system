import { z } from 'zod';
import { USER_ROLES } from '../common/constants';

export const assignRoleSchema = z
  .object({
    role: z.enum(USER_ROLES),
  })
  .strict();

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;