import { describe, it, expect } from 'vitest';
import { getWorkDayByDateSchema, getMonthlyWorkDaysSchema } from './work-day.schema';
import { getDaysInMonth } from '../utils/date';

describe('getWorkDayByDateSchema', () => {
  it('deve aceitar datas válidas reais', () => {
    expect(getWorkDayByDateSchema.safeParse({ date: '2026-09-21' }).success).toBe(true);
    expect(getWorkDayByDateSchema.safeParse({ date: '2028-02-29' }).success).toBe(true); // Ano bissexto
  });

  it('deve rejeitar datas inválidas no calendário', () => {
    expect(getWorkDayByDateSchema.safeParse({ date: '2026-02-31' }).success).toBe(false);
    expect(getWorkDayByDateSchema.safeParse({ date: '2026-13-01' }).success).toBe(false);
    expect(getWorkDayByDateSchema.safeParse({ date: '2026-00-10' }).success).toBe(false);
    expect(getWorkDayByDateSchema.safeParse({ date: '2026-04-31' }).success).toBe(false);
    expect(getWorkDayByDateSchema.safeParse({ date: '2026-02-29' }).success).toBe(false); // 2026 não é bissexto
  });

  it('deve rejeitar formatos incorretos', () => {
    expect(getWorkDayByDateSchema.safeParse({ date: '21/09/2026' }).success).toBe(false);
    expect(getWorkDayByDateSchema.safeParse({ date: '09-21-2026' }).success).toBe(false);
    expect(getWorkDayByDateSchema.safeParse({ date: 'abc' }).success).toBe(false);
  });
});

describe('getMonthlyWorkDaysSchema', () => {
  it('deve aceitar meses válidos no formato YYYY-MM', () => {
    expect(getMonthlyWorkDaysSchema.safeParse({ month: '2026-09' }).success).toBe(true);
    expect(getMonthlyWorkDaysSchema.safeParse({ month: '2028-02' }).success).toBe(true);
  });

  it('deve rejeitar meses inválidos', () => {
    expect(getMonthlyWorkDaysSchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(getMonthlyWorkDaysSchema.safeParse({ month: '2026-00' }).success).toBe(false);
    expect(getMonthlyWorkDaysSchema.safeParse({ month: '09/2026' }).success).toBe(false);
    expect(getMonthlyWorkDaysSchema.safeParse({ month: 'abc' }).success).toBe(false);
  });
});

describe('getDaysInMonth', () => {
  it('deve retornar a quantidade exata de dias para o mês', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28); // Fevereiro normal
    expect(getDaysInMonth(2028, 2)).toBe(29); // Fevereiro bissexto
    expect(getDaysInMonth(2026, 9)).toBe(30); // Setembro
    expect(getDaysInMonth(2026, 12)).toBe(31); // Dezembro
  });
});
