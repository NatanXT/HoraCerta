import { z } from 'zod';

export const getWorkDayByDateSchema = z.object({
  date: z
    .string({
      required_error: 'Data é obrigatória.',
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Formato de data inválido. Utilize YYYY-MM-DD.',
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
      { message: 'Data inválida ou inexistente no calendário.' }
    ),
});

export const getMonthlyWorkDaysSchema = z.object({
  month: z
    .string({
      required_error: 'Mês é obrigatório.',
    })
    .regex(/^\d{4}-\d{2}$/, {
      message: 'Formato de mês inválido. Utilize YYYY-MM.',
    })
    .refine(
      (val) => {
        const [yearStr, monthStr] = val.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        if (month < 1 || month > 12) return false;
        if (year < 1900 || year > 2100) return false;

        return true;
      },
      { message: 'Formato de mês inválido. Utilize YYYY-MM.' }
    ),
});

export type GetWorkDayByDateParams = z.infer<typeof getWorkDayByDateSchema>;
export type GetMonthlyWorkDaysQuery = z.infer<typeof getMonthlyWorkDaysSchema>;
