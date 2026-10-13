import { HolidayProvider, HolidayProviderItem } from './holiday-provider';
import { AppError } from '../errors/app-error';

interface BrasilApiHolidayRawItem {
  date: string;
  name: string;
  type?: string;
}

export class BrasilApiHolidayProvider implements HolidayProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string = 'https://brasilapi.com.br/api/feriados/v1',
    timeoutMs: number = 8000
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  async getNationalHolidays(year: number): Promise<HolidayProviderItem[]> {
    if (!Number.isInteger(year) || year < 1970 || year > 2100) {
      throw new AppError(`Ano inválido para consulta de feriados: ${year}`, 400, 'INVALID_YEAR');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}/${year}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HoraCerta/0.1.0 (BrasilApiHolidayProvider)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          `BrasilAPI retornou status HTTP ${response.status} ao consultar feriados de ${year}.`,
          502,
          'HOLIDAY_PROVIDER_ERROR'
        );
      }

      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) {
        throw new AppError(
          `Formato de resposta inesperado da BrasilAPI para o ano ${year}.`,
          502,
          'HOLIDAY_PROVIDER_INVALID_RESPONSE'
        );
      }

      const results: HolidayProviderItem[] = [];

      for (const item of data as BrasilApiHolidayRawItem[]) {
        if (!item || typeof item.date !== 'string' || typeof item.name !== 'string') {
          continue;
        }

        const trimmedDate = item.date.trim();
        const trimmedName = item.name.trim();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) || !trimmedName) {
          continue;
        }

        results.push({
          date: trimmedDate,
          name: trimmedName,
        });
      }

      return results;
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new AppError(
          `Tempo limite excedido (${this.timeoutMs}ms) ao consultar BrasilAPI para o ano ${year}.`,
          504,
          'HOLIDAY_PROVIDER_TIMEOUT'
        );
      }

      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(
        `Falha na comunicação com a BrasilAPI para o ano ${year}: ${message}`,
        502,
        'HOLIDAY_PROVIDER_NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
