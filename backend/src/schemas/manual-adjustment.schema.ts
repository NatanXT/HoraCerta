import { z } from 'zod';

const timeStringRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const manualIntervalSchema = z
  .object({
    clockIn: z
      .string({
        required_error: 'Horário de entrada é obrigatório.',
      })
      .regex(timeStringRegex, {
        message: 'Horário de entrada inválido. Utilize o formato HH:mm (00:00 às 23:59).',
      }),
    clockOut: z
      .string({
        required_error: 'Horário de saída é obrigatório.',
      })
      .regex(timeStringRegex, {
        message: 'Horário de saída inválido. Utilize o formato HH:mm (00:00 às 23:59).',
      }),
  })
  .refine((data) => data.clockIn < data.clockOut, {
    message: 'O horário de entrada deve ser estritamente anterior ao horário de saída.',
    path: ['clockOut'],
  });

export const manualAdjustmentSchema = z
  .object({
    reason: z
      .string({
        required_error: 'O motivo do ajuste é obrigatório.',
      })
      .transform((val) => val.trim())
      .pipe(
        z
          .string()
          .min(5, { message: 'O motivo do ajuste deve conter pelo menos 5 caracteres.' })
          .max(500, { message: 'O motivo do ajuste deve conter no máximo 500 caracteres.' })
      ),
    intervals: z
      .array(manualIntervalSchema, {
        required_error: 'Lista de intervalos é obrigatória.',
      })
      .min(1, { message: 'Informe pelo menos 1 intervalo de trabalho.' })
      .max(10, { message: 'Máximo de 10 intervalos permitidos por dia.' }),
  })
  .refine(
    (data) => {
      // Check interval ordering and overlapping
      const sorted = [...data.intervals].sort((a, b) => a.clockIn.localeCompare(b.clockIn));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].clockOut >= sorted[i + 1].clockIn) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Os intervalos informados não podem se sobrepor ou coincidir.',
      path: ['intervals'],
    }
  );

export type ManualAdjustmentInput = z.infer<typeof manualAdjustmentSchema>;
export type ManualIntervalInput = z.infer<typeof manualIntervalSchema>;
