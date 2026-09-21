import { describe, it, expect } from 'vitest';
import { getWorkDayByDateSchema } from './work-day.schema';

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
