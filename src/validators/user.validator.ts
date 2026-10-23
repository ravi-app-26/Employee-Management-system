import { z } from 'zod';

export const assignRoleSchema = z
  .object({
    role: z.enum(['admin', 'hr', 'manager', 'employee']),
  })
  .strict();

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;