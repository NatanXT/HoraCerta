// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  getPresetRange,
  getMonthsBetween,
  validateCustomRange,
  isFullMonthRange,
  filterDaysByDateRange,
  calculateSummaryMetrics,
  calculateDailyBalanceDistribution,
  calculateMonthlyAggregations,
  calculateBankHoursEvolution,
  aggregateWorkAnalytics,
  formatMonthShortLabel,
  isValidCivilDate,
  getCivilDaysCount,
} from './analytics-calculator';
import { MonthlyDaySummary } from '../../types/work-day';
import { BankHoursResponse } from '../../types/bank-hours';

describe('analytics-calculator — Suíte Completa de Homologação da ETAPA 12.5.3', () => {
  const TODAY = '2026-11-18';

  const createSyntheticDay = (
    date: string,
    expected: number,
    worked: number,
    balance?: number | null,
    status: MonthlyDaySummary['status'] = 'RECORDED',
    hasAdjustments = false
  ): MonthlyDaySummary => ({
    date,
    expectedMinutes: expected,
    workedMinutes: worked,
    currentSessionMinutes: 0,
    totalWorkedMinutes: worked,
    balanceMinutes: balance !== undefined ? balance : worked - expected,
    isOpen: status === 'IN_PROGRESS',
    status,
    hasManualAdjustments: hasAdjustments,
    entries: worked > 0 ? [{ id: 'e1', type: 'CLOCK_IN', timestamp: `${date}T08:00:00Z` }] : [],
  });

  const createMockBankHours = (configured = true, initialBalance = 120): BankHoursResponse => {
    if (!configured) {
      return {
        configured: false,
        suggestedStartDate: null,
        config: null,
        period: null,
        summary: null,
        monthly: [],
        pending: [],
      };
    }

    return {
      configured: true,
      suggestedStartDate: null,
      config: {
        startDate: '2026-09-01',
        initialBalanceMinutes: initialBalance,
      },
      period: {
        startDate: '2026-09-01',
        endDate: TODAY,
      },
      summary: {
        initialBalanceMinutes: initialBalance,
        consolidatedBalanceMinutes: initialBalance + 120,
        todayBalanceMinutes: 0,
        liveBalanceMinutes: initialBalance + 120,
        creditMinutes: 180,
        debitMinutes: 60,
        accountedDays: 45,
        pendingDays: 0,
      },
      monthly: [
        {
          month: '2026-09',
          creditMinutes: 60,
          debitMinutes: 0,
          netMinutes: 60, // saldo fechamento: initial + 60
          accountedDays: 20,
          pendingDays: 0,
        },
        {
          month: '2026-10',
          creditMinutes: 30,
          debitMinutes: 60,
          netMinutes: -30, // saldo fechamento: initial + 60 - 30
          accountedDays: 22,
          pendingDays: 0,
        },
        {
          month: '2026-11',
          creditMinutes: 90,
          debitMinutes: 0,
          netMinutes: 90, // saldo fechamento: initial + 30 + 90
          accountedDays: 13,
          pendingDays: 0,
        },
      ],
      pending: [],
    };
  };

  // =========================================================================
  // 1. PRESETS DE PERÍODO E NAVEGAÇÃO
  // =========================================================================
  describe('1. Presets de Período e Navegação Temporal', () => {
    it('calcula o intervalo para o mês atual cobrindo o mês civil inteiro', () => {
      const range = getPresetRange('current-month', '2026-11-18');
      expect(range.startDate).toBe('2026-11-01');
      expect(range.endDate).toBe('2026-11-30');
    });

    it('calcula os últimos 3 meses cobrindo do primeiro dia de Setembro ao último de Novembro', () => {
      const range = getPresetRange('last-3-months', '2026-11-18');
      expect(range.startDate).toBe('2026-09-01');
      expect(range.endDate).toBe('2026-11-30');
    });

    it('calcula os últimos 6 meses com virada de ano segura (Fev/2027 a Set/2026)', () => {
      const range = getPresetRange('last-6-months', '2027-02-15');
      expect(range.startDate).toBe('2026-09-01');
      expect(range.endDate).toBe('2027-02-28');
    });

    it('identifica corretamente ranges que representam mês(es) integral(is)', () => {
      expect(isFullMonthRange('2026-11-01', '2026-11-30')).toBe(true);
      expect(isFullMonthRange('2026-09-01', '2026-11-30')).toBe(true);
      expect(isFullMonthRange('2026-11-10', '2026-11-15')).toBe(false);
      expect(isFullMonthRange('2026-11-01', '2026-11-15')).toBe(false);
      expect(isFullMonthRange('2026-11-10', '2026-11-30')).toBe(false);
    });
  });

  // =========================================================================
  // 2. VALIDAÇÃO DE 12 COMPETÊNCIAS E DATAS CIVIS (SEÇÃO 6)
  // =========================================================================
  describe('2. Validação Estrita de 12 Competências e Calendário Civil', () => {
    it('A. 01/01/2026 a 31/12/2026: 12 competências -> permitido', () => {
      const res = validateCustomRange('2026-01-01', '2026-12-31');
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('B. 01/01/2026 a 01/01/2027: 13 competências (mesmo com 365 dias) -> rigorosamente rejeitado', () => {
      const res = validateCustomRange('2026-01-01', '2027-01-01');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('não pode abranger mais de 12 competências mensais');
    });

    it('C. Período atravessando ano civil com 12 competências (01/06/2026 a 31/05/2027) -> permitido', () => {
      const res = validateCustomRange('2026-06-01', '2027-05-31');
      expect(res.isValid).toBe(true);
      expect(getMonthsBetween('2026-06-01', '2027-05-31').length).toBe(12);
    });

    it('D. Fevereiro bissexto: 2028-02-29 permitido; 2026-02-29 rejeitado', () => {
      expect(validateCustomRange('2028-02-01', '2028-02-29').isValid).toBe(true);
      const resNonLeap = validateCustomRange('2026-02-01', '2026-02-29');
      expect(resNonLeap.isValid).toBe(false);
      expect(resNonLeap.error).toContain('Data final não existe no calendário civil');
    });

    it('E. Datas inexistentes (31/04) e ordem invertida -> rejeitados', () => {
      const resInexistent = validateCustomRange('2026-04-01', '2026-04-31');
      expect(resInexistent.isValid).toBe(false);
      expect(resInexistent.error).toContain('Data final não existe no calendário civil');

      const resInverted = validateCustomRange('2026-11-20', '2026-11-10');
      expect(resInverted.isValid).toBe(false);
      expect(resInverted.error).toContain('data final não pode ser anterior');
    });
  });

  // =========================================================================
  // 3. MESES QUE FALHARAM NÃO PODEM APARECER COMO ZERO (SEÇÃO 2)
  // =========================================================================
  describe('3. Integridade de Meses Ausentes e Tratamento de Respostas Parciais', () => {
    it('A. Setembro carregado, Outubro falhou e Novembro carregado: Outubro NÃO aparece como zero oficial', () => {
      const days: MonthlyDaySummary[] = [
        createSyntheticDay('2026-09-10', 480, 540, 60),
        createSyntheticDay('2026-11-10', 480, 480, 0),
      ];

      const rangeMonths = ['2026-09', '2026-10', '2026-11'];
      const failedMonths = ['2026-10'];
      const bh = createMockBankHours(true);

      const aggs = calculateMonthlyAggregations(days, rangeMonths, TODAY, bh, failedMonths);

      expect(aggs.length).toBe(3);
      // Setembro
      expect(aggs[0].month).toBe('2026-09');
      expect(aggs[0].status).toBe('available');
      expect(aggs[0].totalWorkedMinutes).toBe(540);

      // Outubro: FALHOU -> Deve ser UNAVAILABLE com valores NULL, nunca zero!
      expect(aggs[1].month).toBe('2026-10');
      expect(aggs[1].status).toBe('unavailable');
      expect(aggs[1].totalWorkedMinutes).toBeNull();
      expect(aggs[1].totalExpectedMinutes).toBeNull();
      expect(aggs[1].differenceMinutes).toBeNull();
      expect(aggs[1].recordedDaysCount).toBeNull();
      expect(aggs[1].unavailableReason).toContain('Dados indisponíveis');

      // Novembro
      expect(aggs[2].month).toBe('2026-11');
      expect(aggs[2].status).toBe('available');
      expect(aggs[2].totalWorkedMinutes).toBe(480);
    });

    it('B. Outubro carregado integralmente com ausência real de registros: representa zero legítimo (status empty)', () => {
      // 31 dias de Outubro carregados, todos com 0 minutos trabalhados
      const daysOctober: MonthlyDaySummary[] = Array.from({ length: 31 }, (_, i) => {
        const dStr = String(i + 1).padStart(2, '0');
        return createSyntheticDay(`2026-10-${dStr}`, 0, 0, null, 'REST_DAY');
      });

      const aggs = calculateMonthlyAggregations(daysOctober, ['2026-10'], TODAY, null, []);
      expect(aggs[0].status).toBe('empty');
      expect(aggs[0].totalWorkedMinutes).toBe(0);
      expect(aggs[0].totalExpectedMinutes).toBe(0);
      expect(aggs[0].differenceMinutes).toBe(0);
      expect(aggs[0].recordedDaysCount).toBe(0);
    });

    it('C. Resposta parcial com dia ausente da contagem civil: status partial', () => {
      // Novembro tem 30 dias, mas backend só retornou 28 dias
      const daysNovPartial: MonthlyDaySummary[] = Array.from({ length: 28 }, (_, i) => {
        const dStr = String(i + 1).padStart(2, '0');
        return createSyntheticDay(`2026-11-${dStr}`, 480, 480, 0, 'RECORDED');
      });

      const aggs = calculateMonthlyAggregations(daysNovPartial, ['2026-11'], TODAY, null, [], ['2026-11']);
      expect(aggs[0].status).toBe('partial');
      expect(aggs[0].hasIncompleteData).toBe(true);
    });

    it('D. Resposta com dia DATA_UNAVAILABLE: sinaliza parcialidade e não soma valores artificiais', () => {
      const daysWithUnavailable: MonthlyDaySummary[] = [
        createSyntheticDay('2026-11-01', 480, 480, 0, 'RECORDED'),
        createSyntheticDay('2026-11-02', 480, 0, null, 'DATA_UNAVAILABLE'),
      ];

      const range = { startDate: '2026-11-01', endDate: '2026-11-02' };
      const summary = calculateSummaryMetrics(daysWithUnavailable, range, TODAY, null, ['2026-11']);

      // Apenas o dia 01 entra no cálculo
      expect(summary.totalWorkedMinutes).toBe(480);
      expect(summary.totalExpectedMinutes).toBe(480);
      expect(summary.isPartialCoverage).toBe(true);
      expect(summary.coverageDaysCount).toBe(1);
      expect(summary.totalDaysInRange).toBe(2);
    });
  });

  // =========================================================================
  // 4. BANCO DE HORAS E INTERVALOS PERSONALIZADOS (SEÇÃO 3)
  // =========================================================================
  describe('4. Banco de Horas e Intervalos Personalizados', () => {
    it('A. Intervalo parcial (10 a 15 de novembro): NÃO atribui netMinutes de novembro inteiro ao intervalo', () => {
      const days: MonthlyDaySummary[] = [
        createSyntheticDay('2026-11-10', 480, 500, 20),
        createSyntheticDay('2026-11-15', 480, 460, -20),
      ];

      const bh = createMockBankHours(true);
      const partialRange = { startDate: '2026-11-10', endDate: '2026-11-15' };

      const summary = calculateSummaryMetrics(days, partialRange, TODAY, bh, ['2026-11']);

      expect(summary.bankHoursAvailability).toBe('partial_interval_unavailable');
      expect(summary.officialBankHoursNetMinutes).toBeNull();
      expect(summary.bankHoursAvailabilityReason).toContain('exclusivamente por competência mensal inteira');
    });

    it('B. Competências mensais inteiras: soma estritamente os resultados oficiais de netMinutes', () => {
      const days: MonthlyDaySummary[] = [
        createSyntheticDay('2026-09-10', 480, 480, 0),
        createSyntheticDay('2026-10-10', 480, 480, 0),
        createSyntheticDay('2026-11-10', 480, 480, 0),
      ];

      const bh = createMockBankHours(true); // Sep: +60, Oct: -30, Nov: +90 -> Sum: +120 min
      const fullRange = { startDate: '2026-09-01', endDate: '2026-11-30' };

      const summary = calculateSummaryMetrics(days, fullRange, TODAY, bh, ['2026-09', '2026-10', '2026-11']);

      expect(summary.bankHoursAvailability).toBe('configured');
      expect(summary.officialBankHoursNetMinutes).toBe(120); // 60 - 30 + 90
    });

    it('C. Saldo inicial positivo (+120) ou negativo (-180) preservado na curva de fechamento', () => {
      const bhPos = createMockBankHours(true, 120);
      const evolPos = calculateBankHoursEvolution(['2026-09', '2026-10'], bhPos);
      expect(evolPos[0].closingBalanceMinutes).toBe(180); // 120 + 60
      expect(evolPos[1].closingBalanceMinutes).toBe(150); // 180 - 30

      const bhNeg = createMockBankHours(true, -180);
      const evolNeg = calculateBankHoursEvolution(['2026-09', '2026-10'], bhNeg);
      expect(evolNeg[0].closingBalanceMinutes).toBe(-120); // -180 + 60
      expect(evolNeg[1].closingBalanceMinutes).toBe(-150); // -120 - 30
    });

    it('D. Mês anterior à vigência (Agosto/2026 quando vigência inicia em Setembro/2026)', () => {
      const bh = createMockBankHours(true);
      const evol = calculateBankHoursEvolution(['2026-08', '2026-09'], bh);

      expect(evol[0].month).toBe('2026-08');
      expect(evol[0].status).toBe('unconfigured');
      expect(evol[0].isConfiguredPeriod).toBe(false);
      expect(evol[0].closingBalanceMinutes).toBeNull();

      expect(evol[1].month).toBe('2026-09');
      expect(evol[1].status).toBe('closed');
      expect(evol[1].isConfiguredPeriod).toBe(true);
      expect(evol[1].closingBalanceMinutes).toBe(180);
    });

    it('E. Competência oficial ausente no extrato do banco: status unavailable com closingBalance null', () => {
      const bh = createMockBankHours(true);
      // Força extrato sem o mês de Outubro
      bh.monthly = bh.monthly.filter((m) => m.month !== '2026-10');

      const evol = calculateBankHoursEvolution(['2026-09', '2026-10', '2026-11'], bh);
      expect(evol[1].month).toBe('2026-10');
      expect(evol[1].status).toBe('unavailable');
      expect(evol[1].closingBalanceMinutes).toBeNull();
    });

    it('F. Mês corrente em andamento identificado com status in_progress', () => {
      const bh = createMockBankHours(true);
      const evol = calculateBankHoursEvolution(['2026-10', '2026-11'], bh, 'configured', TODAY);

      expect(evol[0].month).toBe('2026-10');
      expect(evol[0].status).toBe('closed');
      expect(evol[0].isCurrentMonth).toBe(false);

      expect(evol[1].month).toBe('2026-11');
      expect(evol[1].status).toBe('in_progress');
      expect(evol[1].isCurrentMonth).toBe(true);
    });
  });

  // =========================================================================
  // 5. FALHA DE CONSULTA vs. BANCO NÃO CONFIGURADO (SEÇÃO 4)
  // =========================================================================
  describe('5. Distinção entre Erro de Conexão e Banco Não Configurado', () => {
    it('quando a API do Banco de Horas rejeita, status é error (nunca unconfigured)', () => {
      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
      const summary = calculateSummaryMetrics([], range, TODAY, null, ['2026-11'], [], 'error');

      expect(summary.bankHoursAvailability).toBe('error');
      expect(summary.bankHoursAvailabilityReason).toContain('Falha ao consultar extrato do Banco de Horas');
      expect(summary.isBankHoursConfigured).toBe(false);

      const evol = calculateBankHoursEvolution(['2026-11'], null, 'error');
      expect(evol[0].status).toBe('unavailable');
      expect(evol[0].closingBalanceMinutes).toBeNull();
    });

    it('quando a API responde configured: false, status é unconfigured', () => {
      const bhUnconfigured = createMockBankHours(false);
      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
      const summary = calculateSummaryMetrics([], range, TODAY, bhUnconfigured, ['2026-11'], [], 'unconfigured');

      expect(summary.bankHoursAvailability).toBe('unconfigured');
      expect(summary.officialBankHoursNetMinutes).toBeNull();

      const evol = calculateBankHoursEvolution(['2026-11'], bhUnconfigured, 'unconfigured');
      expect(evol).toEqual([]);
    });
  });

  // =========================================================================
  // 6. POLÍTICA DE CLASSIFICAÇÃO DOS SALDOS DIÁRIOS (SEÇÃO 5)
  // =========================================================================
  describe('6. Distribuição dos Saldos Diários e Invariante de Partição', () => {
    it('classifica estritamente cada cenário e garante que positive + negative + balanced + unaccounted + unavailable == totalCalendarDays', () => {
      const testDays: MonthlyDaySummary[] = [
        createSyntheticDay('2026-11-01', 480, 540, 60, 'RECORDED'),    // 1. RECORDED saldo positivo
        createSyntheticDay('2026-11-02', 480, 420, -60, 'RECORDED'),   // 2. RECORDED saldo negativo
        createSyntheticDay('2026-11-03', 480, 480, 0, 'RECORDED'),     // 3. RECORDED saldo zero -> balanced
        createSyntheticDay('2026-11-04', 0, 0, 0, 'NO_RECORDS'),       // 4. NO_RECORDS saldo zero -> unaccounted!
        createSyntheticDay('2026-11-05', 0, 0, 0, 'EXCUSED'),          // 5. EXCUSED apurado -> balanced!
        createSyntheticDay('2026-11-06', 0, 0, null, 'REST_DAY'),      // 6. REST_DAY sem trabalho -> unaccounted
        createSyntheticDay('2026-11-07', 480, 240, -240, 'IN_PROGRESS'), // 7. IN_PROGRESS -> unaccounted (provisório)
        createSyntheticDay('2026-11-08', 480, 0, null, 'FUTURE'),      // 8. FUTURE -> unaccounted
        createSyntheticDay('2026-11-09', 0, 0, null, 'DATA_UNAVAILABLE'), // 9. DATA_UNAVAILABLE -> unavailable!
        createSyntheticDay('2026-11-10', 480, 480, null, 'RECORDED'),  // 10. balanceMinutes null -> unaccounted
      ];

      const dist = calculateDailyBalanceDistribution(testDays, TODAY);

      expect(dist.positiveDaysCount).toBe(1);  // Dia 01
      expect(dist.negativeDaysCount).toBe(1);  // Dia 02
      expect(dist.balancedDaysCount).toBe(2);  // Dia 03 e Dia 05
      expect(dist.unaccountedDaysCount).toBe(5); // Dias 04, 06, 07, 08, 10
      expect(dist.unavailableDaysCount).toBe(1); // Dia 09 (DATA_UNAVAILABLE)
      expect(dist.inProgressDaysCount).toBe(1); // Dia 07

      // Invariantes estritos de 5 categorias:
      expect(dist.totalAccountedDays).toBe(4);
      expect(dist.totalCalendarDays).toBe(10);
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(testDays.length);
    });

    it('datas futuras não entram como dias consolidados/apurados e são alocadas em unaccountedDaysCount', () => {
      const days = [
        createSyntheticDay('2026-11-15', 480, 480, 0, 'RECORDED'), // Passado em relação a 2026-11-18
        createSyntheticDay('2026-11-20', 480, 480, 0, 'RECORDED'), // Futuro em relação a 2026-11-18
      ];
      const dist = calculateDailyBalanceDistribution(days, '2026-11-18');
      expect(dist.positiveDaysCount).toBe(0);
      expect(dist.balancedDaysCount).toBe(1); // Apenas dia 15
      expect(dist.unaccountedDaysCount).toBe(1); // Dia 20 é futuro, não consolidado!
      expect(dist.totalAccountedDays).toBe(1);
    });
  });

  // =========================================================================
  // 8. R2 — INTEGRIDADE E CONTRATOS DO BANCO DE HORAS COM LACUNAS E CONTINUIDADE
  // =========================================================================
  describe('8. R2 — Integridade do Banco de Horas com Lacunas e Continuidade', () => {
    it('Três meses consecutivos com dados: calcula fechamento acumulado contínuo', () => {
      const bh = createMockBankHours(true, 120); // Inicial: +120. Set: +60, Out: -30, Nov: +90
      const evol = calculateBankHoursEvolution(['2026-09', '2026-10', '2026-11'], bh);

      expect(evol[0].closingBalanceMinutes).toBe(180); // 120 + 60
      expect(evol[1].closingBalanceMinutes).toBe(150); // 180 - 30
      expect(evol[2].closingBalanceMinutes).toBe(240); // 150 + 90
    });

    it('Mês intermediário omitido: NÃO presume zero e NÃO confirma fechamento posterior à lacuna', () => {
      const bh = createMockBankHours(true, 120);
      // Simula resposta com Outubro omitido (lacuna desconhecida)
      bh.monthly = [
        {
          month: '2026-09',
          creditMinutes: 60,
          debitMinutes: 0,
          netMinutes: 60,
          accountedDays: 20,
          pendingDays: 0,
        },
        {
          month: '2026-11',
          creditMinutes: 90,
          debitMinutes: 0,
          netMinutes: 90,
          accountedDays: 13,
          pendingDays: 0,
        },
      ];

      const evol = calculateBankHoursEvolution(['2026-09', '2026-10', '2026-11'], bh);

      // Setembro (anterior à lacuna): fechamento confirmado
      expect(evol[0].month).toBe('2026-09');
      expect(evol[0].closingBalanceMinutes).toBe(180);

      // Outubro (lacuna omitida): indisponível, closing nulo
      expect(evol[1].month).toBe('2026-10');
      expect(evol[1].status).toBe('unavailable');
      expect(evol[1].closingBalanceMinutes).toBeNull();

      // Novembro (posterior à lacuna): variação mensal conhecida (+90), mas fechamento acumulado NULO e status unconfirmed (não confirmado!)
      expect(evol[2].month).toBe('2026-11');
      expect(evol[2].status).toBe('unconfirmed');
      expect(evol[2].monthlyNetMinutes).toBe(90);
      expect(evol[2].closingBalanceMinutes).toBeNull();

      // No sumário do período completo, disponibilidade é statement_incomplete (não 'error')
      const summary = calculateSummaryMetrics([], { startDate: '2026-09-01', endDate: '2026-11-30' }, TODAY, bh, [
        '2026-09',
        '2026-10',
        '2026-11',
      ]);
      expect(summary.bankHoursAvailability).toBe('statement_incomplete');
      expect(summary.officialBankHoursNetMinutes).toBeNull();
      expect(summary.bankHoursAvailabilityReason).toContain('competência 2026-10 ausente');
    });

    it('Mês sem movimentação comprovadamente zero: preserva fechamento acumulado contínuo', () => {
      const bh = createMockBankHours(true, 120);
      // Outubro comprovadamente com movimento zero (presente no extrato com netMinutes: 0)
      bh.monthly = [
        {
          month: '2026-09',
          creditMinutes: 60,
          debitMinutes: 0,
          netMinutes: 60,
          accountedDays: 20,
          pendingDays: 0,
        },
        {
          month: '2026-10',
          creditMinutes: 0,
          debitMinutes: 0,
          netMinutes: 0,
          accountedDays: 0,
          pendingDays: 0,
        },
        {
          month: '2026-11',
          creditMinutes: 90,
          debitMinutes: 0,
          netMinutes: 90,
          accountedDays: 13,
          pendingDays: 0,
        },
      ];

      const evol = calculateBankHoursEvolution(['2026-09', '2026-10', '2026-11'], bh);

      expect(evol[0].closingBalanceMinutes).toBe(180); // 120 + 60
      expect(evol[1].closingBalanceMinutes).toBe(180); // 180 + 0 (provadamente zero!)
      expect(evol[2].closingBalanceMinutes).toBe(270); // 180 + 90
    });

    it('Saldo inicial negativo (-120) com competências válidas', () => {
      const bh = createMockBankHours(true, -120);
      const evol = calculateBankHoursEvolution(['2026-09', '2026-10'], bh);

      expect(evol[0].closingBalanceMinutes).toBe(-60); // -120 + 60
      expect(evol[1].closingBalanceMinutes).toBe(-90); // -60 - 30
    });

    it('Período anterior à vigência (Agosto antes de Setembro)', () => {
      const bh = createMockBankHours(true, 120);
      const evol = calculateBankHoursEvolution(['2026-08', '2026-09'], bh);

      expect(evol[0].status).toBe('unconfigured');
      expect(evol[0].closingBalanceMinutes).toBeNull();
      expect(evol[1].status).toBe('closed');
      expect(evol[1].closingBalanceMinutes).toBe(180);
    });
  });

  // =========================================================================
  // 9. R2 — DISTRIBUIÇÃO COM DATAS NÃO RECEBIDAS E CONTAGEM CIVIL REAL
  // =========================================================================
  describe('9. R2 — Distribuição com Datas Não Recebidas e Contagem Civil Real', () => {
    const HISTORICAL_REF_DATE = '2026-12-01'; // Data de referência posterior a Novembro para meses históricos fechados

    it('Novembro com 30 dias recebidos: totalCalendarDays é 30 e unavailableDaysCount é 0', () => {
      const days: MonthlyDaySummary[] = [];
      for (let d = 1; d <= 30; d++) {
        const dStr = `2026-11-${String(d).padStart(2, '0')}`;
        days.push(createSyntheticDay(dStr, 480, 480, 0, 'RECORDED'));
      }

      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
      const dist = calculateDailyBalanceDistribution(days, HISTORICAL_REF_DATE, range);

      expect(dist.totalCalendarDays).toBe(30);
      expect(dist.totalAccountedDays).toBe(30);
      expect(dist.unavailableDaysCount).toBe(0);
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(30);
    });

    it('Novembro com apenas 28 dias recebidos: totalCalendarDays é 30 e unavailableDaysCount é 2', () => {
      const days: MonthlyDaySummary[] = [];
      for (let d = 1; d <= 28; d++) {
        const dStr = `2026-11-${String(d).padStart(2, '0')}`;
        days.push(createSyntheticDay(dStr, 480, 480, 0, 'RECORDED'));
      }

      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
      const dist = calculateDailyBalanceDistribution(days, HISTORICAL_REF_DATE, range);

      expect(dist.totalCalendarDays).toBe(30);
      expect(dist.totalAccountedDays).toBe(28);
      expect(dist.unavailableDaysCount).toBe(2); // 2 dias civis não fornecidos pelo servidor
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(30);
    });

    it('Resposta com 30 entradas contendo 1 duplicata e 1 dia ausente: totalCalendarDays é 30 e unavailableDaysCount é 1', () => {
      const days: MonthlyDaySummary[] = [];
      // Adiciona dias de 01 a 29
      for (let d = 1; d <= 29; d++) {
        const dStr = `2026-11-${String(d).padStart(2, '0')}`;
        days.push(createSyntheticDay(dStr, 480, 480, 0, 'RECORDED'));
      }
      // Adiciona 1 duplicata do dia 05 (totalizando 30 entradas no array, mas cobrindo apenas 29 datas únicas)
      days.push(createSyntheticDay('2026-11-05', 480, 480, 0, 'RECORDED'));

      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
      const dist = calculateDailyBalanceDistribution(days, HISTORICAL_REF_DATE, range);

      expect(dist.totalCalendarDays).toBe(30);
      expect(dist.totalAccountedDays).toBe(29); // Não infla com a duplicata!
      expect(dist.unavailableDaysCount).toBe(1); // Dia 30 ausente
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(30);
    });

    it('Resposta com data fora do intervalo: é ignorada e não contamina a contagem do range', () => {
      const days = [
        createSyntheticDay('2026-11-01', 480, 480, 0, 'RECORDED'),
        createSyntheticDay('2026-12-05', 480, 480, 0, 'RECORDED'), // Fora do intervalo de Novembro!
      ];
      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
      const dist = calculateDailyBalanceDistribution(days, HISTORICAL_REF_DATE, range);

      expect(dist.totalCalendarDays).toBe(30);
      expect(dist.totalAccountedDays).toBe(1); // Apenas 2026-11-01
      expect(dist.unavailableDaysCount).toBe(29); // 29 dias restantes de Novembro ausentes
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(30);
    });

    it('Resposta com DATA_UNAVAILABLE explícito: entra em unavailableDaysCount', () => {
      const days = [
        createSyntheticDay('2026-11-01', 480, 480, 0, 'RECORDED'),
        createSyntheticDay('2026-11-02', 0, 0, null, 'DATA_UNAVAILABLE'),
      ];
      const range = { startDate: '2026-11-01', endDate: '2026-11-02' };
      const dist = calculateDailyBalanceDistribution(days, HISTORICAL_REF_DATE, range);

      expect(dist.totalCalendarDays).toBe(2);
      expect(dist.totalAccountedDays).toBe(1);
      expect(dist.unavailableDaysCount).toBe(1); // Dia 02 com DATA_UNAVAILABLE
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(2);
    });

    it('R2.1.1 — Rejeita datas inexistentes como 2026-11-31 mesmo quando lexicalmente dentro do range (2026-11-29 a 2026-12-02)', () => {
      const days = [
        createSyntheticDay('2026-11-29', 480, 480, 0, 'RECORDED'),
        createSyntheticDay('2026-11-31', 480, 480, 0, 'RECORDED'), // Inválida! Não existe no calendário civil
        createSyntheticDay('2026-12-01', 480, 480, 0, 'RECORDED'),
      ];
      const range = { startDate: '2026-11-29', endDate: '2026-12-02' };
      const dist = calculateDailyBalanceDistribution(days, '2026-12-03', range);

      expect(dist.totalCalendarDays).toBe(4);
      expect(dist.balancedDaysCount).toBe(2);
      expect(dist.unavailableDaysCount).toBe(2); // 2026-11-30 e 2026-12-02 ausentes
      expect(dist.totalAccountedDays).toBe(2);
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(4);
    });

    it('R2.1.1 — Rejeita datas inexistentes quando range não for informado', () => {
      const days = [
        createSyntheticDay('2026-11-29', 480, 480, 0, 'RECORDED'),
        createSyntheticDay('2026-11-31', 480, 480, 0, 'RECORDED'), // Inválida!
      ];
      const dist = calculateDailyBalanceDistribution(days, '2026-12-03');

      expect(dist.totalCalendarDays).toBe(1); // Apenas 2026-11-29
      expect(dist.balancedDaysCount).toBe(1);
      expect(dist.unavailableDaysCount).toBe(0);
      expect(dist.totalAccountedDays).toBe(1);
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(1);
    });

    it('Mês inteiro com falha na consulta (0 dias recebidos para Novembro)', () => {
      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
      const dist = calculateDailyBalanceDistribution([], TODAY, range);

      expect(dist.totalCalendarDays).toBe(30);
      expect(dist.totalAccountedDays).toBe(0);
      expect(dist.unavailableDaysCount).toBe(30);
      expect(dist.unaccountedDaysCount).toBe(0);
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(30);
    });

    it('Período personalizado de 6 dias recebendo apenas 4 datas', () => {
      const days = [
        createSyntheticDay('2026-11-01', 480, 540, 60, 'RECORDED'),
        createSyntheticDay('2026-11-02', 480, 420, -60, 'RECORDED'),
        createSyntheticDay('2026-11-03', 480, 480, 0, 'RECORDED'),
        createSyntheticDay('2026-11-04', 0, 0, null, 'REST_DAY'),
      ];
      const range = { startDate: '2026-11-01', endDate: '2026-11-06' }; // 6 dias civis
      const dist = calculateDailyBalanceDistribution(days, HISTORICAL_REF_DATE, range);

      expect(dist.totalCalendarDays).toBe(6);
      expect(dist.totalAccountedDays).toBe(3);
      expect(dist.unavailableDaysCount).toBe(2); // Dias 05 e 06 não fornecidos
      expect(
        dist.positiveDaysCount +
          dist.negativeDaysCount +
          dist.balancedDaysCount +
          dist.unaccountedDaysCount +
          dist.unavailableDaysCount
      ).toBe(6);
    });

    it('Fevereiro de 2028 (ano bissexto): conta exatamente 29 dias civis', () => {
      const days = [createSyntheticDay('2028-02-01', 480, 480, 0, 'RECORDED')];
      const range = { startDate: '2028-02-01', endDate: '2028-02-29' };
      const dist = calculateDailyBalanceDistribution(days, '2028-02-15', range);

      expect(dist.totalCalendarDays).toBe(29);
      expect(dist.unavailableDaysCount).toBe(28);
    });

    it('Intervalo atravessando virada de ano (28/12/2026 a 02/01/2027): exatamente 6 dias civis', () => {
      const count = getCivilDaysCount('2026-12-28', '2027-01-02');
      expect(count).toBe(6); // 28, 29, 30, 31 dez + 01, 02 jan

      const range = { startDate: '2026-12-28', endDate: '2027-01-02' };
      const dist = calculateDailyBalanceDistribution([], TODAY, range);
      expect(dist.totalCalendarDays).toBe(6);
      expect(dist.unavailableDaysCount).toBe(6);
    });
  });

  // =========================================================================
  // 10. R2 — ESCOPO DA VARIAÇÃO DO BANCO DE HORAS NO COMPARATIVO MENSAL
  // =========================================================================
  describe('10. R2 — Escopo da Variação do Banco de Horas no Comparativo Mensal', () => {
    it('Filtro de 10 a 15 de novembro: marca isFractionOfCompetence = true', () => {
      const days = [createSyntheticDay('2026-11-10', 480, 480, 0)];
      const bh = createMockBankHours(true);
      const range = { startDate: '2026-11-10', endDate: '2026-11-15' };

      const aggs = calculateMonthlyAggregations(days, ['2026-11'], TODAY, bh, [], [], range);

      expect(aggs[0].month).toBe('2026-11');
      expect(aggs[0].isFractionOfCompetence).toBe(true);
    });

    it('Filtro de 01 a 30 de novembro: marca isFractionOfCompetence = false', () => {
      const days = [createSyntheticDay('2026-11-10', 480, 480, 0)];
      const bh = createMockBankHours(true);
      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };

      const aggs = calculateMonthlyAggregations(days, ['2026-11'], TODAY, bh, [], [], range);

      expect(aggs[0].month).toBe('2026-11');
      expect(aggs[0].isFractionOfCompetence).toBe(false);
      expect(aggs[0].bankHoursNetMinutes).toBe(90);
    });

    it('Filtro de 15 de outubro a 15 de novembro: ambos os meses marcados como fração', () => {
      const days = [
        createSyntheticDay('2026-10-20', 480, 480, 0),
        createSyntheticDay('2026-11-10', 480, 480, 0),
      ];
      const bh = createMockBankHours(true);
      const range = { startDate: '2026-10-15', endDate: '2026-11-15' };

      const aggs = calculateMonthlyAggregations(days, ['2026-10', '2026-11'], TODAY, bh, [], [], range);

      expect(aggs[0].isFractionOfCompetence).toBe(true);
      expect(aggs[1].isFractionOfCompetence).toBe(true);
    });

    it('Três competências completas (01/09 a 30/11): todos isFractionOfCompetence = false', () => {
      const bh = createMockBankHours(true);
      const range = { startDate: '2026-09-01', endDate: '2026-11-30' };

      const aggs = calculateMonthlyAggregations([], ['2026-09', '2026-10', '2026-11'], TODAY, bh, [], [], range);

      expect(aggs.every((a) => !a.isFractionOfCompetence)).toBe(true);
      expect(aggs[0].bankHoursNetMinutes).toBe(60);
      expect(aggs[1].bankHoursNetMinutes).toBe(-30);
      expect(aggs[2].bankHoursNetMinutes).toBe(90);
    });

    it('Banco não configurado no comparativo mensal: bankHoursNetMinutes é null e isBankHoursActiveInMonth é false', () => {
      const bh = createMockBankHours(false);
      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };

      const aggs = calculateMonthlyAggregations([], ['2026-11'], TODAY, bh, [], [], range);

      expect(aggs[0].isBankHoursActiveInMonth).toBe(false);
      expect(aggs[0].bankHoursNetMinutes).toBeNull();
      expect(aggs[0].bankHoursCumulativeClosingBalance).toBeNull();
    });

    it('Competência com falha de consulta: status unavailable', () => {
      const bh = createMockBankHours(true);
      const range = { startDate: '2026-11-01', endDate: '2026-11-30' };

      const aggs = calculateMonthlyAggregations([], ['2026-11'], TODAY, bh, ['2026-11'], [], range);

      expect(aggs[0].status).toBe('unavailable');
      expect(aggs[0].totalWorkedMinutes).toBeNull();
      expect(aggs[0].bankHoursNetMinutes).toBeNull();
    });
  });

  // =========================================================================
  // 11. R2 — VALIDAÇÃO DE DATAS CIVIS E DIAS NO MÊS
  // =========================================================================
  describe('11. R2 — Validação de Datas Civis e getCivilDaysCount', () => {
    it('isValidCivilDate valida rigorosamente dias civis reais e bissextos', () => {
      expect(isValidCivilDate('2026-11-30')).toBe(true);
      expect(isValidCivilDate('2026-11-31')).toBe(false); // Novembro tem 30 dias
      expect(isValidCivilDate('2028-02-29')).toBe(true);  // 2028 é bissexto
      expect(isValidCivilDate('2027-02-29')).toBe(false); // 2027 não é bissexto
      expect(isValidCivilDate('2026-02-28')).toBe(true);
      expect(isValidCivilDate('invalid-date')).toBe(false);
      expect(isValidCivilDate('2026-13-01')).toBe(false); // Mês 13 não existe
      expect(isValidCivilDate('2026-00-10')).toBe(false);
      expect(isValidCivilDate('2026-05-32')).toBe(false);
    });

    it('getCivilDaysCount calcula a contagem inclusiva exata', () => {
      expect(getCivilDaysCount('2026-11-01', '2026-11-30')).toBe(30);
      expect(getCivilDaysCount('2028-02-01', '2028-02-29')).toBe(29);
      expect(getCivilDaysCount('2026-12-28', '2027-01-02')).toBe(6);
      expect(getCivilDaysCount('2026-11-10', '2026-11-10')).toBe(1);
    });
  });
});
