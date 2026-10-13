import { z } from 'zod';

export const syncHolidaysSchema = z.object({
  year: z
    .number({ invalid_type_error: 'O ano deve ser um número inteiro.' })
    .int('O ano deve ser um número inteiro.')
    .min(1970, 'O ano deve ser maior ou igual a 1970.')
    .max(2100, 'O ano deve ser menor ou igual a 2100.'),
});

export const getHolidaysQuerySchema = z.object({
  year: z.coerce
    .number({ invalid_type_error: 'O ano deve ser um número inteiro válido.' })
    .int('O ano deve ser um número inteiro válido.')
    .min(1970, 'O ano deve ser maior ou igual a 1970.')
    .max(2100, 'O ano deve ser menor ou igual a 2100.'),
});

export type SyncHolidaysInput = z.infer<typeof syncHolidaysSchema>;
export type GetHolidaysQueryInput = z.infer<typeof getHolidaysQuerySchema>;
