import { z } from 'zod';
import { Weekday } from '@prisma/client';

export const updateProfileSchema = z.object({
  name: z
    .string({
      required_error: 'Nome é obrigatório.',
      invalid_type_error: 'Nome deve ser texto.',
    })
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(2, 'Nome deve ter no mínimo 2 caracteres.')
        .max(100, 'Nome deve ter no máximo 100 caracteres.')
    ),
});

const ALL_WEEKDAYS: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

const workScheduleDaySchema = z.object({
  weekday: z.nativeEnum(Weekday, {
    required_error: 'Dia da semana é obrigatório.',
    invalid_type_error: 'Dia da semana inválido.',
  }),
  expectedMinutes: z
    .number({
      required_error: 'Minutos esperados são obrigatórios.',
      invalid_type_error: 'Minutos esperados devem ser um número inteiro.',
    })
    .int('Minutos esperados devem ser um número inteiro.')
    .min(0, 'Minutos esperados não podem ser negativos.')
    .max(1440, 'Minutos esperados não podem exceder 1440 minutos (24 horas).'),
});

export const updateWorkScheduleSchema = z.object({
  days: z
    .array(workScheduleDaySchema, {
      required_error: 'Lista de dias é obrigatória.',
      invalid_type_error: 'Lista de dias inválida.',
    })
    .length(7, 'A jornada deve conter exatamente 7 dias.')
    .superRefine((days, ctx) => {
      const weekdaysSeen = new Set<Weekday>();
      for (const day of days) {
        if (weekdaysSeen.has(day.weekday)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Dia da semana ${day.weekday} duplicado.`,
          });
        }
        weekdaysSeen.add(day.weekday);
      }

      for (const expectedWeekday of ALL_WEEKDAYS) {
        if (!weekdaysSeen.has(expectedWeekday)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Dia da semana ${expectedWeekday} ausente.`,
          });
        }
      }
    }),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type UpdateWorkScheduleDto = z.infer<typeof updateWorkScheduleSchema>;
