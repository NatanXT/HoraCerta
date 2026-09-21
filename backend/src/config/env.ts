import dotenv from 'dotenv';

dotenv.config();

function validateTimezone(tz: string): string {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch (_error) {
    throw new Error(
      `[Configuração Inválida] APP_TIMEZONE informado "${tz}" não é um fuso horário válido. Forneça um timezone IANA válido como "America/Sao_Paulo".`
    );
  }
}

const rawTimezone = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
const APP_TIMEZONE = validateTimezone(rawTimezone);

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3333,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || '',
  APP_TIMEZONE,
  DEFAULT_USER_EMAIL: process.env.DEFAULT_USER_EMAIL || 'usuario@horacerta.local',
};
