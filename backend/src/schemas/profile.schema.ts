import { z } from 'zod';
import { Weekday } from '@prisma/client';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
});

const weekdayEnum = z.nativeEnum(Weekday);

export const workScheduleDayInputSchema = z.object({
  weekday: weekdayEnum,
  isWorkDay: z.boolean().optional(),
  expectedMinutes: z.number().int().nonnegative().optional(),
  plannedStartMinutes: z.number().int().nullable().optional(),
  plannedEndMinutes: z.number().int().nullable().optional(),
  snackBreakMinutes: z.number().int().nonnegative().default(0),
  lunchBreakMinutes: z.number().int().nonnegative().default(0),
});

export const updateWorkScheduleSchema = z.object({
  days: z.array(workScheduleDayInputSchema).length(7, 'A escala deve conter os 7 dias da semana.'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateWorkScheduleInput = z.infer<typeof updateWorkScheduleSchema>;
