import { Request, Response, NextFunction } from 'express';

/**
 * NOTA DE ARQUITETURA SOBRE ARMAZENAMENTO DE RATE LIMIT EM MEMÓRIA:
 * O armazenamento dos contadores em Maps em memória (`ipRecords`, `accountRecords`, `resetIpRecords`)
 * é leve, rápido e atende perfeitamente ao ambiente de servidor em instância única (single-node).
 * 
 * LIMITAÇÕES EM AMBIENTES DISTRIBUÍDOS:
 * Em infraestruturas escaladas horizontalmente (múltiplas réplicas, clusters ou serverless), cada processo
 * Node.js possui seu próprio Map de memória isolado. Nesses cenários, clientes maliciosos poderiam
 * distribuir requisições entre instâncias diferentes sem atingir o teto de um nó individual.
 * Para ambientes distribuídos em produção, recomenda-se substituir este mecanismo em memória por um
 * armazenamento compartilhado e atômico como Redis (utilizando INCR e EXPIRE com janelas deslizantes).
 */

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipRecords = new Map<string, RateLimitRecord>();
const accountRecords = new Map<string, RateLimitRecord>();
const resetIpRecords = new Map<string, RateLimitRecord>();

export const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
export const MAX_FORGOT_PER_IP = 5;
export const MAX_FORGOT_PER_ACCOUNT = 3;
export const MAX_RESET_PER_IP = 5;
export const MAX_MAP_SIZE = 1000;

/**
 * Resolve o IP do cliente utilizando req.ip do Express.
 * No app.ts, 'trust proxy' está desativado por padrão no Express (req.app.get('trust proxy') === false).
 * Portanto, req.ip lê diretamente o endereço do socket de conexão (req.socket.remoteAddress),
 * impedindo que atacantes manipulem o rate limiter através do cabeçalho X-Forwarded-For injetado.
 */
export function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Remove exclusivamente os registros cuja janela temporal já expirou (now > record.resetAt).
 * Jamais remove ou descarta antecipadamente bloqueios ativos.
 */
export function pruneExpired(map: Map<string, RateLimitRecord>, now: number): void {
  for (const [key, record] of map.entries()) {
    if (now > record.resetAt) {
      map.delete(key);
    }
  }
}

/**
 * Rate limit para solicitação de recuperação de senha (/forgot-password)
 * - 5 tentativas por IP / 15 minutos
 * - 3 tentativas por conta de e-mail / 15 minutos
 * - Capacidade máxima limitada a 1.000 identidades por mapa
 * - Não incrementa parcialmente se a solicitação for rejeitada
 */
export function forgotPasswordRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const now = Date.now();

  // 1. Limpa registros expirados
  pruneExpired(ipRecords, now);
  pruneExpired(accountRecords, now);

  // 2. Validação prévia de IP (sem mutação prévia)
  const ipRecord = ipRecords.get(ip);
  if (ipRecord) {
    if (ipRecord.count >= MAX_FORGOT_PER_IP) {
      res.status(429).json({
        error: 'Muitas tentativas a partir deste endereço IP. Aguarde 15 minutos antes de tentar novamente.',
      });
      return;
    }
  } else {
    // Nova identidade de IP com capacidade esgotada
    if (ipRecords.size >= MAX_MAP_SIZE) {
      res.status(429).json({
        error: 'Capacidade de solicitações temporariamente esgotada. Aguarde alguns instantes antes de tentar novamente.',
      });
      return;
    }
  }

  // 3. Validação prévia de Conta de E-mail (se fornecida, sem mutação prévia)
  let accountRecord: RateLimitRecord | undefined;
  if (email) {
    accountRecord = accountRecords.get(email);
    if (accountRecord) {
      if (accountRecord.count >= MAX_FORGOT_PER_ACCOUNT) {
        res.status(429).json({
          error: 'Muitas tentativas de recuperação para este e-mail. Aguarde 15 minutos antes de tentar novamente.',
        });
        return;
      }
    } else {
      // Nova identidade de conta com capacidade esgotada
      if (accountRecords.size >= MAX_MAP_SIZE) {
        res.status(429).json({
          error: 'Capacidade de solicitações temporariamente esgotada. Aguarde alguns instantes antes de tentar novamente.',
        });
        return;
      }
    }
  }

  // 4. Todas as validações foram aprovadas: mutação atômica dos contadores
  if (ipRecord) {
    ipRecord.count += 1;
  } else {
    ipRecords.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  }

  if (email) {
    if (accountRecord) {
      accountRecord.count += 1;
    } else {
      accountRecords.set(email, { count: 1, resetAt: now + WINDOW_MS });
    }
  }

  next();
}

/**
 * Rate limit para consumo de redefinição de senha (/reset-password)
 * - 5 tentativas por IP / 15 minutos
 * - Capacidade máxima limitada a 1.000 identidades
 * - Não incrementa contadores caso rejeitado por capacidade esgotada
 */
export function resetPasswordRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();

  pruneExpired(resetIpRecords, now);

  const record = resetIpRecords.get(ip);
  if (record) {
    if (record.count >= MAX_RESET_PER_IP) {
      res.status(429).json({
        error: 'Muitas tentativas de redefinição a partir deste endereço IP. Aguarde 15 minutos antes de tentar novamente.',
      });
      return;
    }
    record.count += 1;
  } else {
    if (resetIpRecords.size >= MAX_MAP_SIZE) {
      res.status(429).json({
        error: 'Capacidade de solicitações temporariamente esgotada. Aguarde alguns instantes antes de tentar novamente.',
      });
      return;
    }
    resetIpRecords.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  }

  next();
}

/**
 * Utilitário para limpar os registros de rate limit em testes automatizados
 */
export function resetAuthRateLimits(): void {
  ipRecords.clear();
  accountRecords.clear();
  resetIpRecords.clear();
}

/**
 * Utilitário para inspecionar estado interno em testes
 */
export function getRateLimitState() {
  return {
    ipRecords,
    accountRecords,
    resetIpRecords,
  };
}
