import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailService } from './mail.service.js';
import { env } from '../config/env.js';

describe('MailService', () => {
  let mockTransporter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransporter = {
      sendMail: vi.fn(),
    };
  });

  it('A) when SMTP is configured, real transport is invoked with correct options', async () => {
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-12345' });

    // Initialize MailService with custom mock transporter simulating configured SMTP
    const mailService = new MailService(mockTransporter);

    const result = await mailService.sendPasswordResetEmail({
      to: 'user@example.com',
      name: 'João Silva',
      resetUrl: 'http://localhost:5173/redefinir-senha?token=abc123',
      expiresMinutes: 20,
    });

    expect(result).toEqual({
      success: true,
      simulated: false,
      messageId: 'msg-12345',
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    const mailArgs = mockTransporter.sendMail.mock.calls[0][0];
    expect(mailArgs.to).toBe('user@example.com');
    expect(mailArgs.subject).toBe('HoraCerta — Recuperação de Senha');
    expect(mailArgs.text).toContain('João Silva');
    expect(mailArgs.text).toContain('http://localhost:5173/redefinir-senha?token=abc123');
    expect(mailArgs.html).toContain('Redefinir Minha Senha');
  });

  it('B) when SMTP is absent / not configured, does NOT declare real delivery (simulated: true)', async () => {
    // Save original env values
    const origHost = env.SMTP_HOST;
    const origUser = env.SMTP_USER;
    env.SMTP_HOST = '';
    env.SMTP_USER = '';

    try {
      const mailService = new MailService(); // no transporter, no env
      expect(mailService.isSmtpConfigured()).toBe(false);

      const result = await mailService.sendPasswordResetEmail({
        to: 'user@example.com',
        name: 'Maria Souza',
        resetUrl: 'http://localhost:5173/redefinir-senha?token=xyz789',
        expiresMinutes: 20,
      });

      expect(result).toEqual({
        success: true,
        simulated: true,
      });

      // Stored in in-memory simulation buffer
      expect(mailService.getSentEmails()).toHaveLength(1);
      expect(mailService.getSentEmails()[0].to).toBe('user@example.com');
    } finally {
      env.SMTP_HOST = origHost;
      env.SMTP_USER = origUser;
    }
  });

  it('C) when SMTP fails, handles error safely without leaking credentials', async () => {
    mockTransporter.sendMail.mockRejectedValue(new Error('Connection timeout to mail server'));

    const mailService = new MailService(mockTransporter);

    await expect(
      mailService.sendPasswordResetEmail({
        to: 'user@example.com',
        name: 'Carlos',
        resetUrl: 'http://localhost:5173/redefinir-senha?token=failtoken',
        expiresMinutes: 20,
      })
    ).rejects.toThrow('Connection timeout to mail server');
  });

  it('D) isSmtpConfigured requires all 5 variables and rejects partial or empty configurations', () => {
    const origHost = env.SMTP_HOST;
    const origPort = env.SMTP_PORT;
    const origUser = env.SMTP_USER;
    const origPass = env.SMTP_PASSWORD;
    const origFrom = env.SMTP_FROM;

    const mailService = new MailService();

    try {
      // Configuração completa
      env.SMTP_HOST = 'smtp.example.com';
      env.SMTP_PORT = 587;
      env.SMTP_USER = 'smtp-user';
      env.SMTP_PASSWORD = 'smtp-password';
      env.SMTP_FROM = 'no-reply@example.com';
      expect(mailService.isSmtpConfigured()).toBe(true);

      // Falta SMTP_PASSWORD
      env.SMTP_PASSWORD = '';
      expect(mailService.isSmtpConfigured()).toBe(false);

      // SMTP_PASSWORD apenas espaços em branco
      env.SMTP_PASSWORD = '   ';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_PASSWORD = 'valid-pass';

      // Falta SMTP_HOST
      env.SMTP_HOST = '';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_HOST = 'smtp.example.com';

      // Falta SMTP_USER
      env.SMTP_USER = '';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_USER = 'smtp-user';

      // Falta SMTP_FROM
      env.SMTP_FROM = '';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_FROM = 'no-reply@example.com';

      // SMTP_PORT inválido
      env.SMTP_PORT = 0;
      expect(mailService.isSmtpConfigured()).toBe(false);
    } finally {
      env.SMTP_HOST = origHost;
      env.SMTP_PORT = origPort;
      env.SMTP_USER = origUser;
      env.SMTP_PASSWORD = origPass;
      env.SMTP_FROM = origFrom;
    }
  });

  it('E) in production mode, unconfigured SMTP blocks delivery and never retains tokens in memory buffer', async () => {
    const origEnv = process.env.NODE_ENV;
    const origHost = env.SMTP_HOST;
    process.env.NODE_ENV = 'production';
    env.SMTP_HOST = '';

    try {
      const mailService = new MailService();

      await expect(
        mailService.sendPasswordResetEmail({
          to: 'prod@example.com',
          name: 'Prod User',
          resetUrl: 'https://app.horacerta.com/redefinir-senha?token=secret123',
          expiresMinutes: 20,
        })
      ).rejects.toThrow('Serviço de e-mail não configurado em ambiente de produção.');

      expect(mailService.getSentEmails()).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = origEnv;
      env.SMTP_HOST = origHost;
    }
  });

  it('F) in production mode with transporter, tokens are sent and NOT retained in memory buffer', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'prod-msg-1' });

    try {
      const mailService = new MailService(mockTransporter);

      const res = await mailService.sendPasswordResetEmail({
        to: 'prod@example.com',
        name: 'Prod User',
        resetUrl: 'https://app.horacerta.com/redefinir-senha?token=secret123',
        expiresMinutes: 20,
      });

      expect(res.success).toBe(true);
      expect(res.simulated).toBe(false);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      // Em produção, o buffer em memória NÃO deve reter o e-mail/token
      expect(mailService.getSentEmails()).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

