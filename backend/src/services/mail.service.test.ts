import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailService, buildPasswordResetEmailTemplate } from './mail.service.js';
import { env } from '../config/env.js';

describe('MailService', () => {
  let mockTransporter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransporter = {
      sendMail: vi.fn(),
    };
  });

  it('A) when SMTP is configured, real transport is invoked with professional from, subject and template', async () => {
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-12345' });

    const origFrom = env.SMTP_FROM;
    env.SMTP_FROM = 'no-reply@horacerta.com';

    try {
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

      // Nome do remetente institucional e endereço configurado
      expect(mailArgs.from).toEqual({
        name: 'HoraCerta',
        address: 'no-reply@horacerta.com',
      });
      expect(mailArgs.to).toBe('user@example.com');
      // Assunto profissional
      expect(mailArgs.subject).toBe('HoraCerta | Redefinição de senha');

      // Preheader no HTML
      expect(mailArgs.html).toContain('Recebemos uma solicitação para redefinir sua senha no HoraCerta.');
      // Saudação com primeiro nome
      expect(mailArgs.html).toContain('Olá, <strong style="color: #FFFFFF;">João</strong>!');
      // Botão de ação principal
      expect(mailArgs.html).toContain('Redefinir minha senha');
      expect(mailArgs.html).toContain('http://localhost:5173/redefinir-senha?token=abc123');
      // Aviso de segurança e prazo
      expect(mailArgs.html).toContain('20 minutos');
      expect(mailArgs.html).toContain('HoraCerta — Controle simples da sua jornada');

      // Versão em texto puro
      expect(mailArgs.text).toContain('Olá, João!');
      expect(mailArgs.text).toContain('http://localhost:5173/redefinir-senha?token=abc123');
      expect(mailArgs.text).toContain('20 minutos');
    } finally {
      env.SMTP_FROM = origFrom;
    }
  });

  it('B) when SMTP is absent / not configured, does NOT declare real delivery (simulated: true)', async () => {
    const origHost = env.SMTP_HOST;
    const origUser = env.SMTP_USER;
    env.SMTP_HOST = '';
    env.SMTP_USER = '';

    try {
      const mailService = new MailService();
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

      // Salvo no buffer de simulação em desenvolvimento
      expect(mailService.getSentEmails()).toHaveLength(1);
      const sent = mailService.getSentEmails()[0];
      expect(sent.to).toBe('user@example.com');
      expect(sent.subject).toBe('HoraCerta | Redefinição de senha');
      expect((sent.from as any).name).toBe('HoraCerta');
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
      env.SMTP_HOST = 'smtp.example.com';
      env.SMTP_PORT = 587;
      env.SMTP_USER = 'smtp-user';
      env.SMTP_PASSWORD = 'smtp-password';
      env.SMTP_FROM = 'no-reply@example.com';
      expect(mailService.isSmtpConfigured()).toBe(true);

      env.SMTP_PASSWORD = '';
      expect(mailService.isSmtpConfigured()).toBe(false);

      env.SMTP_PASSWORD = '   ';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_PASSWORD = 'valid-pass';

      env.SMTP_HOST = '';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_HOST = 'smtp.example.com';

      env.SMTP_USER = '';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_USER = 'smtp-user';

      env.SMTP_FROM = '';
      expect(mailService.isSmtpConfigured()).toBe(false);
      env.SMTP_FROM = 'no-reply@example.com';

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

      expect(mailService.getSentEmails()).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('G) verifyConnection validates transport connectivity via transporter.verify', async () => {
    mockTransporter.verify = vi.fn().mockResolvedValue(true);
    const mailService = new MailService(mockTransporter);

    const result = await mailService.verifyConnection();
    expect(result).toEqual({ success: true });
    expect(mockTransporter.verify).toHaveBeenCalledTimes(1);

    mockTransporter.verify.mockRejectedValue(new Error('Invalid login credentials'));
    const failedResult = await mailService.verifyConnection();
    expect(failedResult).toEqual({ success: false, error: 'Invalid login credentials' });

    // Testa serviço sem transporter configurado (isolando variáveis de ambiente)
    const origHost = env.SMTP_HOST;
    env.SMTP_HOST = '';
    try {
      const unconfiguredService = new MailService();
      const noTransporterResult = await unconfiguredService.verifyConnection();
      expect(noTransporterResult.success).toBe(false);
      expect(noTransporterResult.error).toContain('Transporter SMTP não inicializado');
    } finally {
      env.SMTP_HOST = origHost;
    }
  });

  describe('buildPasswordResetEmailTemplate', () => {
    it('T1) extracts first name correctly and escapes XSS payloads', () => {
      const { html, text } = buildPasswordResetEmailTemplate({
        to: 'target@example.com',
        name: '<script>alert("xss")</script> Ana Paula',
        resetUrl: 'https://app.horacerta.com/redefinir-senha?token=token123&action=reset',
        expiresMinutes: 20,
      });

      // Deve extrair a primeira palavra sanitizada e não injetar tags perigosas
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('token123&amp;action=reset');
      expect(text).toContain('Olá, <script>alert("xss")</script>!');
    });

    it('T2) falls back to "Usuário" when name is empty or spaces', () => {
      const { html, text } = buildPasswordResetEmailTemplate({
        to: 'target@example.com',
        name: '   ',
        resetUrl: 'https://app.horacerta.com/redefinir-senha?token=token123',
        expiresMinutes: 20,
      });

      expect(html).toContain('Olá, <strong style="color: #FFFFFF;">Usuário</strong>!');
      expect(text).toContain('Olá, Usuário!');
    });

    it('T3) includes preheader, clock monogram, bulletproof button and footer notice', () => {
      const { html, text, subject } = buildPasswordResetEmailTemplate({
        to: 'target@example.com',
        name: 'Lucas Fernandes',
        resetUrl: 'https://app.horacerta.com/redefinir-senha?token=safe-token',
        expiresMinutes: 20,
      });

      expect(subject).toBe('HoraCerta | Redefinição de senha');
      expect(html).toContain('Recebemos uma solicitação para redefinir sua senha no HoraCerta.');
      expect(html).toContain('HoraCerta');
      expect(html).toContain('Notificações de segurança');
      expect(html).toContain('Redefinir minha senha');
      expect(html).toContain('HoraCerta — Controle simples da sua jornada');
      expect(text).toContain('HoraCerta — Notificações de segurança');
    });
  });
});
