import { z } from 'zod';
import { CalendarOccurrenceType } from '@prisma/client';
import { dateParamSchema } from './work-day.schema';

export const calendarOccurrenceTypeSchema = z.nativeEnum(CalendarOccurrenceType, {
  errorMap: () => ({ message: 'Tipo de ocorrência inválido.' }),
});

export const calendarOccurrenceQuerySchema = z
  .object({
    from: dateParamSchema,
    to: dateParamSchema,
  })
  .refine((data) => data.from <= data.to, {
    message: 'Data inicial (from) não pode ser maior que a data final (to).',
    path: ['to'],
  });

export const createCalendarOccurrenceSchema = z
  .object({
    type: calendarOccurrenceTypeSchema,
    title: z
      .string({
        required_error: 'Título é obrigatório.',
      })
      .trim()
      .min(2, { message: 'Título deve ter no mínimo 2 caracteres.' })
      .max(100, { message: 'Título deve ter no máximo 100 caracteres.' }),
    startDate: dateParamSchema,
    endDate: dateParamSchema,
    note: z
      .string()
      .trim()
      .max(500, { message: 'Observação deve ter no máximo 500 caracteres.' })
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'Data inicial não pode ser maior que a data final.',
    path: ['endDate'],
  });

export const updateCalendarOccurrenceSchema = createCalendarOccurrenceSchema;

export type CalendarOccurrenceQuery = z.infer<typeof calendarOccurrenceQuerySchema>;
export type CreateCalendarOccurrenceInput = z.infer<typeof createCalendarOccurrenceSchema>;
export type UpdateCalendarOccurrenceInput = z.infer<typeof updateCalendarOccurrenceSchema>;
