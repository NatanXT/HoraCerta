import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  forgotPasswordRateLimit,
  resetPasswordRateLimit,
  resetAuthRateLimits,
  getClientIp,
  pruneExpired,
  getRateLimitState,
  MAX_MAP_SIZE,
} from './auth-rate-limit.middleware.js';

describe('auth-rate-limit middlewares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthRateLimits();
  });

  describe('forgotPasswordRateLimit - Normal limits', () => {
    it('F1) enforces IP rate limiting (max 5 requests per 15 min window)', () => {
      const next = vi.fn();
      const req = {
        ip: '192.168.1.100',
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
        body: { email: 'unique1@example.com' },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      // Primeiras 5 requisições sucedem
      for (let i = 0; i < 5; i++) {
        req.body.email = `unique${i}@example.com`;
        forgotPasswordRateLimit(req, res, next);
        expect(next).toHaveBeenCalledTimes(i + 1);
      }

      // 6ª requisição do mesmo IP é bloqueada com 429
      req.body.email = 'unique6@example.com';
      forgotPasswordRateLimit(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Muitas tentativas a partir deste endereço IP'),
        })
      );
    });

    it('F2) enforces account rate limiting (max 3 requests per 15 min window for same email)', () => {
      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      // Requisições de IPs diferentes para o mesmo e-mail
      for (let i = 0; i < 3; i++) {
        const req = {
          ip: `10.0.0.${i + 1}`,
          headers: {},
          socket: { remoteAddress: `10.0.0.${i + 1}` },
          body: { email: 'target.account@example.com' },
        } as any;
        forgotPasswordRateLimit(req, res, next);
        expect(next).toHaveBeenCalledTimes(i + 1);
      }

      // 4ª requisição para o mesmo e-mail a partir de outro IP é bloqueada com 429
      const req4 = {
        ip: '10.0.0.99',
        headers: {},
        socket: { remoteAddress: '10.0.0.99' },
        body: { email: 'TARGET.ACCOUNT@example.com' },
      } as any;

      forgotPasswordRateLimit(req4, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Muitas tentativas de recuperação para este e-mail'),
        })
      );
    });

    it('F3) resolves real IP from req.ip without trusting spoofed X-Forwarded-For', () => {
      const reqWithSpoofedHeader = {
        ip: '203.0.113.195', // IP real resolvido pelo Express
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        socket: { remoteAddress: '203.0.113.195' },
      } as any;

      const resolvedIp = getClientIp(reqWithSpoofedHeader);
      expect(resolvedIp).toBe('203.0.113.195');
      expect(resolvedIp).not.toBe('1.2.3.4');
    });
  });

  describe('resetPasswordRateLimit - Normal limits', () => {
    it('F4) enforces 5 requests per IP limit on reset password', () => {
      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      const req = {
        ip: '172.16.0.50',
        headers: {},
        socket: { remoteAddress: '172.16.0.50' },
        body: { token: 'abc', newPassword: '123' },
      } as any;

      for (let i = 0; i < 5; i++) {
        resetPasswordRateLimit(req, res, next);
        expect(next).toHaveBeenCalledTimes(i + 1);
      }

      // 6ª requisição
      resetPasswordRateLimit(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Muitas tentativas de redefinição'),
        })
      );
    });
  });

  describe('Strict Capacity & Active Block Preservation Policy', () => {
    it('A) Mapa com 1.000 clientes bloqueados ativos: nenhum bloqueio é removido antes da expiração', () => {
      const { ipRecords } = getRateLimitState();
      const now = Date.now();

      // Preenche com exatamente 1.000 clientes bloqueados ativos (5 tentativas cada)
      for (let i = 0; i < 1000; i++) {
        ipRecords.set(`192.168.${Math.floor(i / 250)}.${i % 250}`, {
          count: 5,
          resetAt: now + (i + 10) * 1000, // todos ativos no futuro
        });
      }

      expect(ipRecords.size).toBe(1000);

      // Executa rotina de poda temporal
      pruneExpired(ipRecords, now);

      // Nenhum bloqueio pode ser descartado
      expect(ipRecords.size).toBe(1000);
      for (let i = 0; i < 1000; i++) {
        const key = `192.168.${Math.floor(i / 250)}.${i % 250}`;
        expect(ipRecords.has(key)).toBe(true);
        expect(ipRecords.get(key)!.count).toBe(5);
      }
    });

    it('B) Nova identidade com mapa cheio: rejeita com HTTP 429 sem inserir novo registro', () => {
      const { ipRecords } = getRateLimitState();
      const now = Date.now();

      // Mapa saturado com 1.000 entradas ativas
      for (let i = 0; i < 1000; i++) {
        ipRecords.set(`10.100.${Math.floor(i / 250)}.${i % 250}`, {
          count: 5,
          resetAt: now + 60000,
        });
      }

      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      const newIpReq = {
        ip: '198.51.100.99', // Novo IP não presente no mapa
        headers: {},
        socket: { remoteAddress: '198.51.100.99' },
        body: { email: 'user@example.com' },
      } as any;

      forgotPasswordRateLimit(newIpReq, res, next);

      // Deve rejeitar com HTTP 429
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Capacidade de solicitações temporariamente esgotada'),
        })
      );

      // Não deve ter inserido o novo IP no mapa (permanece exatamente 1.000)
      expect(ipRecords.has('198.51.100.99')).toBe(false);
      expect(ipRecords.size).toBe(1000);
    });

    it('C) Identidade já bloqueada com mapa cheio: continua bloqueada e rejeitada com HTTP 429', () => {
      const { ipRecords } = getRateLimitState();
      const now = Date.now();

      for (let i = 0; i < 1000; i++) {
        ipRecords.set(`172.20.${Math.floor(i / 250)}.${i % 250}`, {
          count: 5,
          resetAt: now + 60000,
        });
      }

      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      // Requisição originada de um IP que já está bloqueado no mapa cheio
      const blockedReq = {
        ip: '172.20.0.5',
        headers: {},
        socket: { remoteAddress: '172.20.0.5' },
        body: { email: 'user@example.com' },
      } as any;

      forgotPasswordRateLimit(blockedReq, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Muitas tentativas a partir deste endereço IP'),
        })
      );
      expect(ipRecords.size).toBe(1000);
    });

    it('D) Registros expirados: liberam capacidade para novas solicitações', () => {
      const { ipRecords } = getRateLimitState();
      const now = Date.now();

      // 900 registros ativos e 100 registros expirados (total = 1.000)
      for (let i = 0; i < 900; i++) {
        ipRecords.set(`active.${i}`, { count: 5, resetAt: now + 60000 });
      }
      for (let i = 0; i < 100; i++) {
        ipRecords.set(`expired.${i}`, { count: 5, resetAt: now - 5000 });
      }

      expect(ipRecords.size).toBe(1000);

      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      const newReq = {
        ip: 'active.new.client',
        headers: {},
        socket: { remoteAddress: 'active.new.client' },
        body: { email: 'new@example.com' },
      } as any;

      // Ao processar, limpa os 100 expirados e aceita o novo cliente
      forgotPasswordRateLimit(newReq, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(ipRecords.has('active.new.client')).toBe(true);
      expect(ipRecords.has('expired.0')).toBe(false);
      // 900 ativos anteriores + 1 novo = 901 registros
      expect(ipRecords.size).toBe(901);
    });

    it('E) Memória: o mapa nunca ultrapassa MAX_MAP_SIZE (1000)', () => {
      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      // Dispara 1.300 requisições com IPs distintos
      for (let i = 0; i < 1300; i++) {
        const req = {
          ip: `unique-ip-${i}`,
          headers: {},
          socket: { remoteAddress: `unique-ip-${i}` },
          body: { email: `unique-email-${i}@example.com` },
        } as any;

        forgotPasswordRateLimit(req, res, next);
      }

      const { ipRecords, accountRecords } = getRateLimitState();
      // O tamanho de ambos os mapas é estritamente limitado em 1000
      expect(ipRecords.size).toBe(MAX_MAP_SIZE);
      expect(accountRecords.size).toBe(MAX_MAP_SIZE);
    });

    it('G) Não incrementa parcialmente contadores caso uma solicitação seja rejeitada por capacidade ou bloqueio', () => {
      const { ipRecords, accountRecords } = getRateLimitState();
      const now = Date.now();

      // Cenário 1: E-mail já bloqueado (3 tentativas)
      accountRecords.set('blocked.target@example.com', { count: 3, resetAt: now + 60000 });

      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      const reqWithNewIp = {
        ip: 'brand-new-ip-123',
        headers: {},
        socket: { remoteAddress: 'brand-new-ip-123' },
        body: { email: 'blocked.target@example.com' },
      } as any;

      forgotPasswordRateLimit(reqWithNewIp, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Muitas tentativas de recuperação para este e-mail'),
        })
      );
      // Garante que o IP não foi registrado/incrementado parcialmente
      expect(ipRecords.has('brand-new-ip-123')).toBe(false);

      // Cenário 2: accountRecords está cheio (1.000), IP é novo
      resetAuthRateLimits();
      for (let i = 0; i < 1000; i++) {
        accountRecords.set(`account.${i}@example.com`, { count: 1, resetAt: now + 60000 });
      }

      const reqAccountFull = {
        ip: 'brand-new-ip-456',
        headers: {},
        socket: { remoteAddress: 'brand-new-ip-456' },
        body: { email: 'brand-new-account@example.com' },
      } as any;

      forgotPasswordRateLimit(reqAccountFull, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Capacidade de solicitações temporariamente esgotada'),
        })
      );
      // Garante que o IP não foi inserido nem incrementado
      expect(ipRecords.has('brand-new-ip-456')).toBe(false);
    });
  });
});
