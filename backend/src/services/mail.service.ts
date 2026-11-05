import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}

export interface MailSendResult {
  success: boolean;
  simulated: boolean;
  messageId?: string;
}

export class MailService {
  private sentEmails: SendMailOptions[] = [];
  private transporter: Transporter | null = null;

  constructor(customTransporter?: Transporter) {
    if (customTransporter) {
      this.transporter = customTransporter;
    } else if (this.isSmtpConfigured()) {
      const port = env.SMTP_PORT || 587;
      const secure = port === 465;
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: true,
        },
      });
    }
  }

  /**
   * Verifica se o serviço de SMTP possui todas as 5 variáveis obrigatórias devidamente preenchidas.
   * Não aceita configuração parcial ou strings vazias/espaços em branco.
   */
  isSmtpConfigured(): boolean {
    const host = typeof env.SMTP_HOST === 'string' ? env.SMTP_HOST.trim() : '';
    const port = typeof env.SMTP_PORT === 'number' ? env.SMTP_PORT : parseInt(String(env.SMTP_PORT), 10);
    const user = typeof env.SMTP_USER === 'string' ? env.SMTP_USER.trim() : '';
    const pass = typeof env.SMTP_PASSWORD === 'string' ? env.SMTP_PASSWORD.trim() : '';
    const from = typeof env.SMTP_FROM === 'string' ? env.SMTP_FROM.trim() : '';

    return Boolean(
      host.length > 0 &&
      !isNaN(port) &&
      port > 0 &&
      user.length > 0 &&
      pass.length > 0 &&
      from.length > 0
    );
  }

  /**
   * Retorna os e-mails registrados no buffer em memória
   */
  getSentEmails(): SendMailOptions[] {
    return [...this.sentEmails];
  }

  /**
   * Limpa o buffer de e-mails em memória
   */
  clearSentEmails(): void {
    this.sentEmails = [];
  }

  /**
   * Envia o e-mail de recuperação de senha com template responsivo e seguro
   */
  async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<MailSendResult> {
    const { to, name, resetUrl, expiresMinutes } = params;

    const subject = 'HoraCerta — Recuperação de Senha';

    const text = [
      `Olá, ${name || 'Usuário'}!`,
      '',
      'Recebemos uma solicitação para redefinir a sua senha no HoraCerta.',
      '',
      'Para cadastrar uma nova senha, acesse o link abaixo:',
      resetUrl,
      '',
      `Este link é de uso único e expira em ${expiresMinutes} minutos.`,
      '',
      'Se você não solicitou a redefinição de senha, ignore este e-mail. Sua conta permanece segura.',
      '',
      'Equipe HoraCerta',
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .brand-title { font-size: 20px; font-weight: bold; color: #f8fafc; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #334155; font-size: 12px; color: #94a3b8; }
    .notice { font-size: 13px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <span class="brand-title">HoraCerta</span>
    </div>
    <h2 style="margin-top: 0; font-size: 18px; color: #f8fafc;">Recuperação de Senha</h2>
    <p class="notice">Olá, <strong>${escapeHtml(name || 'Usuário')}</strong>!</p>
    <p class="notice">Recebemos uma solicitação para redefinir a sua senha de acesso ao HoraCerta.</p>
    <div>
      <a href="${escapeHtml(resetUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Redefinir Minha Senha</a>
    </div>
    <p class="notice">Este link é de uso único e expira em <strong>${expiresMinutes} minutos</strong>.</p>
    <p class="notice">Se você não solicitou a alteração, por favor ignore esta mensagem. Nenhuma alteração foi realizada em sua conta.</p>
    <div class="footer">
      <p style="margin: 0;">Se o botão não funcionar, copie e cole o link no seu navegador:</p>
      <p style="margin: 4px 0 0 0; word-break: break-all; color: #818cf8;">${escapeHtml(resetUrl)}</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const mailOptions: SendMailOptions = { to, subject, html, text };
    const isProduction = process.env.NODE_ENV === 'production';

    // Envio real quando SMTP configurado ou com transporte explícito fornecido
    if (this.isSmtpConfigured() || this.transporter) {
      if (!this.transporter) {
        throw new Error('Transporter SMTP não inicializado.');
      }

      try {
        const info = await this.transporter.sendMail({
          from: env.SMTP_FROM?.trim() || env.SMTP_USER?.trim() || 'nao-responda@horacerta.local',
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
        });

        // Em produção, não reter tokens ou mensagens em buffer de memória
        if (!isProduction) {
          this.sentEmails.push(mailOptions);
        }
        return { success: true, simulated: false, messageId: info.messageId };
      } catch (error) {
        // Registra apenas a mensagem de erro do transporte sem vazar URLs nem tokens
        console.error('[MailService] Falha ao enviar e-mail via transporte SMTP:', (error as Error).message);
        throw error;
      }
    }

    // Em produção: nunca fingir envio com buffer em memória quando SMTP não configurado
    if (isProduction) {
      console.error('[MailService] SMTP não configurado em ambiente de produção. Envio bloqueado.');
      throw new Error('Serviço de e-mail não configurado em ambiente de produção.');
    }

    // Modo local / desenvolvimento: fallback sem SMTP configurado (simulado)
    this.sentEmails.push(mailOptions);
    return { success: true, simulated: true };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const mailService = new MailService();
