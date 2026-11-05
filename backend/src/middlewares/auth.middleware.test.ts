import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth } from './auth.middleware.js';
import { generateToken } from '../utils/auth.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

describe('requireAuth Middleware with authVersion revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('I) Novo login após reset: token com authVersion correspondente é validado com sucesso', async () => {
    const validToken = generateToken({
      userId: 'user-1',
      email: 'user1@example.com',
      name: 'User 1',
      authVersion: 3,
    });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      authVersion: 3,
    } as any);

    const req = {
      cookies: { auth_token: validToken },
      headers: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth.userId).toBe('user-1');
    expect(req.auth.authVersion).toBe(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('H) Sessão antiga após reset: token com authVersion desatualizado é rejeitado com HTTP 401', async () => {
    const oldToken = generateToken({
      userId: 'user-1',
      email: 'user1@example.com',
      name: 'User 1',
      authVersion: 2, // Token emitido na versão 2
    });

    // Usuário agora está na versão 3 (após redefinição de senha)
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      authVersion: 3,
    } as any);

    const req = {
      cookies: { auth_token: oldToken },
      headers: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sessão revogada após redefinição de senha.' });
  });

  it('H2a) Token verdadeiramente legado sem authVersion é ACEITO se o usuário ainda não redefiniu senha (authVersion === 0)', async () => {
    // JWT assinado diretamente sem a claim authVersion (legado genuíno)
    const trulyLegacyToken = jwt.sign(
      {
        userId: 'user-legacy-0',
        email: 'legacy0@example.com',
        name: 'Legacy User 0',
      },
      env.AUTH_SECRET,
      { expiresIn: '7d' }
    );

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-legacy-0',
      authVersion: 0,
    } as any);

    const req = {
      cookies: { auth_token: trulyLegacyToken },
      headers: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth.userId).toBe('user-legacy-0');
    expect(req.auth.authVersion).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('H2b) Token verdadeiramente legado sem authVersion é REJEITADO com HTTP 401 se o usuário já redefiniu senha (authVersion > 0)', async () => {
    // JWT assinado diretamente sem a claim authVersion (legado genuíno)
    const trulyLegacyToken = jwt.sign(
      {
        userId: 'user-legacy-1',
        email: 'legacy1@example.com',
        name: 'Legacy User 1',
      },
      env.AUTH_SECRET,
      { expiresIn: '7d' }
    );

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-legacy-1',
      authVersion: 1, // Senha já redefinida ao menos uma vez
    } as any);

    const req = {
      cookies: { auth_token: trulyLegacyToken },
      headers: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sessão revogada após redefinição de senha.' });
  });

  it('J) Banco indisponível durante validação: NUNCA autoriza por fallback silencioso (Fail-Closed HTTP 503)', async () => {
    const validToken = generateToken({
      userId: 'user-1',
      email: 'user1@example.com',
      name: 'User 1',
      authVersion: 1,
    });

    // Simula queda de conexão com o banco de dados
    vi.spyOn(prisma.user, 'findUnique').mockRejectedValue(new Error('Connection to database failed: ECONNREFUSED'));

    const req = {
      cookies: { auth_token: validToken },
      headers: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await requireAuth(req, res, next);

    // Fail-Closed: NÃO pode chamar next()
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Serviço de validação de autenticação temporariamente indisponível'),
      })
    );
  });

  it('K) JWT de usuário A não autentica como usuário B', async () => {
    const tokenA = generateToken({
      userId: 'user-A',
      email: 'userA@example.com',
      name: 'User A',
      authVersion: 0,
    });

    vi.spyOn(prisma.user, 'findUnique').mockImplementation((async ({ where }: any) => {
      if (where.id === 'user-A') {
        return { id: 'user-A', authVersion: 0 } as any;
      }
      return null;
    }) as any);

    const req = {
      cookies: { auth_token: tokenA },
      headers: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth.userId).toBe('user-A');
    expect(req.auth.userId).not.toBe('user-B');
  });
});
