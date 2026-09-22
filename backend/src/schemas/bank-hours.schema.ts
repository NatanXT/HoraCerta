import { z } from 'zod';
import { env } from '../config/env';
import { getLocalDateString } from '../utils/date';

export const saveBankHoursConfigSchema = z.object({
  startDate: z
    .string({
      required_error: 'Data inicial é obrigatória.',
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Data inicial inválida. Utilize uma data real no formato YYYY-MM-DD.',
    })
    .refine(
      (val) => {
        const [yearStr, monthStr, dayStr] = val.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;

        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return (
          dateObj.getUTCFullYear() === year &&
          dateObj.getUTCMonth() === month - 1 &&
          dateObj.getUTCDate() === day
        );
      },
      { message: 'Data inicial inválida. Utilize uma data real no formato YYYY-MM-DD.' }
    )
    .refine(
      (val) => {
        const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
        return val <= todayStr;
      },
      { message: 'A data inicial da apuração não pode ser futura.' }
    ),
  initialBalanceMinutes: z
    .number({
      required_error: 'Saldo inicial em minutos é obrigatório.',
      invalid_type_error: 'Saldo inicial deve ser um número inteiro.',
    })
    .int({ message: 'Saldo inicial deve ser um número inteiro em minutos.' }),
});

export type SaveBankHoursConfigInput = z.infer<typeof saveBankHoursConfigSchema>;

