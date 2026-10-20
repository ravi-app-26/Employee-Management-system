import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(128),
  })
  .strict();

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(72),
    departmentId: z.string().uuid(),
    jobTitle: z.string().trim().min(1).max(100),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(72),
  })
  .strict();