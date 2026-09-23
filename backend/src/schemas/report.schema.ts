import { z } from 'zod';
import { dateParamSchema } from './work-day.schema';
import { parseDateToUtcMidnight } from '../utils/date';
import { AppError } from '../errors/app-error';

export const reportQuerySchema = z
  .object({
    from: dateParamSchema,
    to: dateParamSchema,
  })
  .superRefine((data, ctx) => {
    if (data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data inicial (from) não pode ser maior que a data final (to).',
        path: ['to'],
      });
      return;
    }

    const fromDate = parseDateToUtcMidnight(data.from);
    const toDate = parseDateToUtcMidnight(data.to);

    const diffDays =
      Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O período do relatório não pode ultrapassar 366 dias.',
        path: ['to'],
      });
    }
  });

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

/**
 * Helper function to validate and return parsed report query input or throw structured AppError.
 */
export function validateReportQuery(query: unknown): { from: string; to: string } {
  const result = reportQuerySchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    const isPeriodError = issue?.message.includes('366 dias');
    const errorCode = isPeriodError ? 'INVALID_REPORT_PERIOD' : 'INVALID_REPORT_QUERY';
    throw new AppError(
      issue?.message || 'Parâmetros de relatório inválidos.',
      400,
      errorCode
    );
  }
  return result.data;
}
