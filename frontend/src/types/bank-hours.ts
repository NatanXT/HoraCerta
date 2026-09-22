export interface BankHoursConfig {
  startDate: string;
  initialBalanceMinutes: number;
}

export interface BankHoursPeriod {
  startDate: string;
  endDate: string;
}

export interface BankHoursSummary {
  initialBalanceMinutes: number;
  consolidatedBalanceMinutes: number;
  todayBalanceMinutes: number | null;
  liveBalanceMinutes: number;
  creditMinutes: number;
  debitMinutes: number;
  accountedDays: number;
  pendingDays: number;
}

export interface BankHoursMonthlySummary {
  month: string;
  creditMinutes: number;
  debitMinutes: number;
  netMinutes: number;
  accountedDays: number;
  pendingDays: number;
}

export interface BankHoursPendingDay {
  date: string;
  status: 'NO_RECORDS' | 'INCOMPLETE';
  expectedMinutes: number;
  totalWorkedMinutes: number;
}

export interface BankHoursResponse {
  configured: boolean;
  suggestedStartDate: string | null;
  config: BankHoursConfig | null;
  period: BankHoursPeriod | null;
  summary: BankHoursSummary | null;
  monthly: BankHoursMonthlySummary[];
  pending: BankHoursPendingDay[];
}
