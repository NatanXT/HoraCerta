import { CalendarOccurrenceType } from '@prisma/client';
import { env } from '../config/env';

export interface CsvReportDayInput {
  date: string;
  weekday: string;
  status: string;
  baseExpectedMinutes: number;
  expectedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number | null;
  isBankAccounted: boolean;
  isProvisional: boolean;
  occurrence?: {
    type: CalendarOccurrenceType | string;
    title: string;
    note?: string | null;
  } | null;
  entrySource?: 'CLOCK' | 'MANUAL' | 'MIXED' | null;
  entries: Array<{
    id: string;
    type: 'CLOCK_IN' | 'CLOCK_OUT';
    timestamp: Date | string;
  }>;
}

export interface CsvReportInput {
  period: {
    from: string;
    to: string;
  };
  days: CsvReportDayInput[];
}

const WEEKDAY_NAMES_PT: Record<string, string> = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const STATUS_NAMES_PT: Record<string, string> = {
  RECORDED: 'Registrado',
  EXCUSED: 'Abonado',
  REST_DAY: 'Folga',
  NO_RECORDS: 'Sem registro',
  INCOMPLETE: 'Incompleto',
  IN_PROGRESS: 'Em andamento',
  FUTURE: 'Futuro',
};

const OCCURRENCE_TYPE_LABELS_PT: Record<string, string> = {
  HOLIDAY: 'Feriado',
  VACATION: 'Férias',
  MEDICAL_LEAVE: 'Atestado / afastamento médico',
  JUSTIFIED_ABSENCE: 'Ausência justificada',
  EXCEPTIONAL_DAY_OFF: 'Folga excepcional',
};

/**
 * Sanitizes a single cell value for CSV output with formula injection protection and proper escaping.
 */
export function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (str === '') {
    return '';
  }

  // Remove leading spaces/control chars for prefix check
  const trimmed = str.replace(/^[\s\uFEFF\xA0]+/, '');

  let safeStr = str;

  // Formula Injection check
  const dangerousPrefixes = ['=', '@', '\t', '\r'];
  const startsWithDangerous = dangerousPrefixes.some((p) => trimmed.startsWith(p));

  // For '+' and '-', check if it's NOT a standard formatted number or duration (like +01:30, -00:45, +120, -30)
  const isStandardFormattedNumberOrDuration =
    /^[\+\-]?\d{1,4}(:\d{2})?$/.test(trimmed);

  if (startsWithDangerous || ((trimmed.startsWith('+') || trimmed.startsWith('-')) && !isStandardFormattedNumberOrDuration)) {
    safeStr = `'${str}`;
  }

  // Escape quotes
  const escaped = safeStr.replace(/"/g, '""');

  // Wrap in quotes if contains delimiter ;, quotes, or newline
  if (escaped.includes(';') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
    return `"${escaped}"`;
  }

  return escaped;
}

/**
 * Formats duration minutes to HH:mm string.
 */
export function formatMinutesHuman(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes);
  const hrs = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Formats balance minutes to +HH:mm, -HH:mm or 00:00 string.
 */
export function formatBalanceHuman(balanceMinutes: number | null): string {
  if (balanceMinutes === null) {
    return '';
  }
  if (balanceMinutes === 0) {
    return '00:00';
  }
  const prefix = balanceMinutes > 0 ? '+' : '-';
  return `${prefix}${formatMinutesHuman(balanceMinutes)}`;
}

/**
 * Formats chronological entries into intervals string: "08:00-12:00 | 13:00-17:00" or "08:00-em andamento"
 */
export function formatIntervals(
  entries: Array<{ type: 'CLOCK_IN' | 'CLOCK_OUT'; timestamp: Date | string }>,
  timeZone: string = env.APP_TIMEZONE
): string {
  if (!entries || entries.length === 0) {
    return '';
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const formatTs = (ts: Date | string) => {
    const d = new Date(ts);
    const parts = formatter.formatToParts(d);
    let h = '00', m = '00';
    for (const p of parts) {
      if (p.type === 'hour') h = p.value.padStart(2, '0');
      if (p.type === 'minute') m = p.value.padStart(2, '0');
    }
    return `${h}:${m}`;
  };

  const intervals: string[] = [];
  let openIn: string | null = null;

  for (const entry of sorted) {
    const timeStr = formatTs(entry.timestamp);
    if (entry.type === 'CLOCK_IN') {
      openIn = timeStr;
    } else if (entry.type === 'CLOCK_OUT' && openIn !== null) {
      intervals.push(`${openIn}-${timeStr}`);
      openIn = null;
    }
  }

  if (openIn !== null) {
    intervals.push(`${openIn}-em andamento`);
  }

  return intervals.join(' | ');
}

/**
 * Generates UTF-8 CSV string with BOM (\uFEFF) and ; delimiter.
 */
export function generateWorkHoursCsv(report: CsvReportInput): string {
  const headers = [
    'Data',
    'Dia da semana',
    'Status',
    'Tipo de ocorrência',
    'Título da ocorrência',
    'Jornada base',
    'Jornada efetiva',
    'Trabalhado',
    'Saldo',
    'Jornada base (min)',
    'Jornada efetiva (min)',
    'Trabalhado (min)',
    'Saldo (min)',
    'Intervalos',
    'Origem dos registros',
    'Contabilizado no banco',
    'Provisório',
  ];

  const rows: string[][] = [];
  rows.push(headers);

  for (const day of report.days) {
    const weekdayPt = WEEKDAY_NAMES_PT[day.weekday] || day.weekday;
    const statusPt = STATUS_NAMES_PT[day.status] || day.status;
    const occTypePt = day.occurrence
      ? OCCURRENCE_TYPE_LABELS_PT[day.occurrence.type] || day.occurrence.type
      : '';
    const occTitle = day.occurrence ? day.occurrence.title : '';

    const baseExpectedHuman = formatMinutesHuman(day.baseExpectedMinutes);
    const expectedHuman = formatMinutesHuman(day.expectedMinutes);
    const workedHuman = formatMinutesHuman(day.workedMinutes);
    const balanceHuman = formatBalanceHuman(day.balanceMinutes);

    const intervalsStr = formatIntervals(day.entries);
    const entrySourceStr = day.entrySource || '';
    const isBankAccountedStr = day.isBankAccounted ? 'Sim' : 'Não';
    const isProvisionalStr = day.isProvisional ? 'Sim' : 'Não';

    const row = [
      day.date,
      weekdayPt,
      statusPt,
      occTypePt,
      occTitle,
      baseExpectedHuman,
      expectedHuman,
      workedHuman,
      balanceHuman,
      day.baseExpectedMinutes,
      day.expectedMinutes,
      day.workedMinutes,
      day.balanceMinutes !== null ? day.balanceMinutes : '',
      intervalsStr,
      entrySourceStr,
      isBankAccountedStr,
      isProvisionalStr,
    ].map(sanitizeCsvCell);

    rows.push(row);
  }

  const csvBody = rows.map((row) => row.join(';')).join('\r\n');
  return `\uFEFF${csvBody}`;
}
