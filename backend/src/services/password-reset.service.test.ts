import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { AuthService } from './auth.service.js';
import { mailService } from './mail.service.js';

describe('AuthService - Password Reset Flow', () => {
  let authService: AuthService;
  let mockDb: any;
  let sendPasswordResetEmailSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      passwordResetToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    authService = new AuthService(mockDb);
    sendPasswordResetEmailSpy = vi.spyOn(mailService, 'sendPasswordResetEmail').mockResolvedValue({ success: true, simulated: false });
  });

  describe('forgotPassword', () => {
    it('1. should process valid email, generate hashed token with 20m expiry, and send email', async () => {
      const user = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
      mockDb.user.findUnique.mockResolvedValue(user);
      mockDb.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.passwordResetToken.create.mockResolvedValue({ id: 'token-id' });

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(result.message).toContain('Se existir uma conta com esse e-mail');

      // Invalidate existing tokens
      expect(mockDb.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id, usedAt: null },
      });

      // Insert new token
      expect(mockDb.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: user.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });

      // Verification that sendPasswordResetEmail was called
      expect(sendPasswordResetEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          name: 'Test User',
          resetUrl: expect.stringContaining('/redefinir-senha?token='),
          expiresMinutes: 20,
        })
      );

      // Verify expiration is ~20 minutes in future
      const createCall = mockDb.passwordResetToken.create.mock.calls[0][0];
      const expiryDiffMinutes = (createCall.data.expiresAt.getTime() - Date.now()) / (1000 * 60);
      expect(expiryDiffMinutes).toBeGreaterThan(19);
      expect(expiryDiffMinutes).toBeLessThanOrEqual(20.1);
    });

    it('2. should return the exact same generic message for non-existent email (anti-enumeration)', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: 'nonexistent@example.com' });

      expect(result.message).toContain('Se existir uma conta com esse e-mail');
      expect(mockDb.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendPasswordResetEmailSpy).not.toHaveBeenCalled();
    });

    it('C) should handle mail service failure gracefully without leaking error or breaking response', async () => {
      const user = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
      mockDb.user.findUnique.mockResolvedValue(user);
      mockDb.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.passwordResetToken.create.mockResolvedValue({ id: 'token-id' });
      sendPasswordResetEmailSpy.mockRejectedValue(new Error('SMTP connection timed out'));

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(result.message).toContain('Se existir uma conta com esse e-mail');
    });
  });

  describe('resetPassword', () => {
    const rawToken = 'a'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    it('D) Token válido: redefinição bem-sucedida, consumo atômico e incremento de authVersion', async () => {
      const resetTokenRecord = {
        id: 'token-1',
        tokenHash,
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min restantes
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'old-hash',
          authVersion: 0,
        },
      };

      mockDb.passwordResetToken.findUnique.mockResolvedValue(resetTokenRecord);
      const txMock = {
        user: { update: vi.fn().mockResolvedValue({ id: 'user-123', authVersion: 1 }) },
        passwordResetToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }), // Atomic consumption success
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      mockDb.$transaction.mockImplementation(async (callback: any) => {
        return callback(txMock);
      });

      const result = await authService.resetPassword({
        token: rawToken,
        newPassword: 'newPassword123',
      });

      expect(result.message).toContain('Senha atualizada com sucesso');

      // Verify atomic consumption inside transaction
      expect(txMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'token-1',
          usedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        data: {
          usedAt: expect.any(Date),
        },
      });

      // Verify password was updated (hashed) AND authVersion incremented
      expect(txMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          passwordHash: expect.any(String),
          authVersion: { increment: 1 },
        },
      });

      const updatedHash = txMock.user.update.mock.calls[0][0].data.passwordHash;
      expect(updatedHash).not.toBe('newPassword123');
      expect(updatedHash).not.toBe('old-hash');
    });

    it('E) Token utilizado: rejeição quando usedAt !== null', async () => {
      const resetTokenRecord = {
        id: 'token-1',
        tokenHash,
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: new Date(Date.now() - 60 * 1000), // usado há 1 minuto
      };

      mockDb.passwordResetToken.findUnique.mockResolvedValue(resetTokenRecord);

      await expect(
        authService.resetPassword({
          token: rawToken,
          newPassword: 'newPassword123',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'TOKEN_ALREADY_USED',
      });
    });

    it('F) Token expirado: rejeição quando expiresAt <= now', async () => {
      const resetTokenRecord = {
        id: 'token-1',
        tokenHash,
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 5 * 1000), // expirado há 5 segundos
        usedAt: null,
      };

      mockDb.passwordResetToken.findUnique.mockResolvedValue(resetTokenRecord);

      await expect(
        authService.resetPassword({
          token: rawToken,
          newPassword: 'newPassword123',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'TOKEN_EXPIRED',
      });
    });

    it('G) Dois resets simultâneos (race condition): somente um consegue consumir atomicamente', async () => {
      const resetTokenRecord = {
        id: 'token-concurrent',
        tokenHash,
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      };

      mockDb.passwordResetToken.findUnique.mockResolvedValue(resetTokenRecord);

      // Simula a primeira requisição consumindo o token (count: 1)
      const txMock1 = {
        user: { update: vi.fn().mockResolvedValue({ id: 'user-123' }) },
        passwordResetToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };

      // Simula a segunda requisição simultânea encontrando o token já consumido (count: 0)
      const txMock2 = {
        user: { update: vi.fn() },
        passwordResetToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          deleteMany: vi.fn(),
        },
      };

      // Primeira requisição sucede
      mockDb.$transaction.mockImplementationOnce((cb: any) => cb(txMock1));
      const res1 = await authService.resetPassword({ token: rawToken, newPassword: 'newPasswordA' });
      expect(res1.message).toContain('Senha atualizada com sucesso');

      // Segunda requisição concorrente falha atomicamente no updateMany
      mockDb.$transaction.mockImplementationOnce((cb: any) => cb(txMock2));
      await expect(
        authService.resetPassword({ token: rawToken, newPassword: 'newPasswordB' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'TOKEN_ALREADY_USED',
      });

      // Garante que a segunda requisição não alterou a senha
      expect(txMock2.user.update).not.toHaveBeenCalled();
    });

    it('should reject invalid/non-existent token with INVALID_TOKEN', async () => {
      mockDb.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: rawToken,
          newPassword: 'newPassword123',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_TOKEN',
      });
    });

    it('should reject empty token with INVALID_TOKEN', async () => {
      await expect(
        authService.resetPassword({
          token: '   ',
          newPassword: 'newPassword123',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_TOKEN',
      });
    });
  });
});
