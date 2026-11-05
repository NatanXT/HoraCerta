import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
  email: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, 'A senha deve ter no mínimo 8 caracteres.'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, 'A senha é obrigatória.'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email('E-mail inválido.')
    .transform((val) => val.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Token de recuperação é obrigatório.'),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
