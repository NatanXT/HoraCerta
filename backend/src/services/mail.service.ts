import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface SendMailOptions {
  from?: { name: string; address: string } | string;
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

/**
 * Constrói o template profissional (HTML e Texto Puro) para o e-mail de redefinição de senha
 */
export function buildPasswordResetEmailTemplate(params: PasswordResetEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'HoraCerta | Redefinição de senha';
  const trimmedName = params.name?.trim() || '';
  const firstName = trimmedName ? trimmedName.split(/\s+/)[0] : 'Usuário';
  const currentYear = new Date().getFullYear();

  // Versão em Texto Puro acessível e completa
  const text = [
    'HoraCerta — Notificações de segurança',
    '',
    `Olá, ${firstName}!`,
    '',
    'Recebemos uma solicitação para redefinir a sua senha de acesso à plataforma HoraCerta.',
    '',
    'Para cadastrar uma nova senha, acesse o link seguro abaixo:',
    params.resetUrl,
    '',
    `Este link é individual, de uso único e válido por ${params.expiresMinutes} minutos.`,
    '',
    'Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá inalterada.',
    '',
    '---',
    'HoraCerta — Controle simples da sua jornada',
    'Esta é uma mensagem automática de segurança.',
    `© ${currentYear} HoraCerta. Todos os direitos reservados.`,
  ].join('\n');

  // Versão em HTML profissional compatível com Gmail, Outlook e dispositivos móveis
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #090D16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-card { padding: 24px 20px !important; }
      .email-header { padding: 20px 20px !important; }
      .btn-cta { width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #090D16; color: #F3F4F6;">
  <!-- Preheader oculto para pré-visualização no cliente de e-mail -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Recebemos uma solicitação para redefinir sua senha no HoraCerta.
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#090D16" style="background-color: #090D16; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Card Container Centralizado (Max 580px) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 580px; width: 100%; background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Cabeçalho Institucional -->
          <tr>
            <td class="email-header" style="padding: 24px 32px; border-bottom: 1px solid #1F2937; background-color: #0F172A;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Monograma / Ícone de Relógio -->
                        <td align="center" style="width: 38px; height: 38px; background-color: #4F46E5; border-radius: 10px; color: #FFFFFF; font-size: 19px; font-weight: 700; line-height: 38px; vertical-align: middle;">
                          &#9201;
                        </td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <span style="font-size: 19px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.02em; display: inline-block;">HoraCerta</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-size: 11px; font-weight: 500; color: #9CA3AF; background-color: #1F2937; border: 1px solid #374151; border-radius: 6px; padding: 4px 10px; display: inline-block; white-space: nowrap;">
                      Notificações de segurança
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Conteúdo Principal -->
          <tr>
            <td class="email-card" style="padding: 36px 32px 32px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F9FAFB; letter-spacing: -0.02em; line-height: 1.3;">
                Redefinição de senha
              </h1>

              <p style="margin: 0 0 16px 0; font-size: 15px; color: #E5E7EB; line-height: 1.6;">
                Olá, <strong style="color: #FFFFFF;">${escapeHtml(firstName)}</strong>!
              </p>

              <p style="margin: 0 0 28px 0; font-size: 14px; color: #9CA3AF; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a sua senha de acesso à plataforma HoraCerta. Para cadastrar uma nova senha e restabelecer o seu acesso, clique no botão seguro abaixo:
              </p>

              <!-- Ação Principal (Botão de Destaque) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 32px auto;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #4F46E5;">
                    <a href="${escapeHtml(params.resetUrl)}" class="btn-cta" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 600; color: #FFFFFF !important; text-decoration: none; border-radius: 10px; background-color: #4F46E5; line-height: 1.2; text-align: center; mso-padding-alt: 0;">
                      <!--[if mso]><i style="letter-spacing: 36px; mso-font-width: -100%; mso-text-raise: 20pt;">&nbsp;</i><![endif]-->
                      <span style="mso-text-raise: 10pt;">Redefinir minha senha &rarr;</span>
                      <!--[if mso]><i style="letter-spacing: 36px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Caixa de Aviso de Segurança e Orientação -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #172033; border: 1px solid #1E293B; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #F1F5F9;">
                      &#128274; Aviso de segurança
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #94A3B8; line-height: 1.5;">
                      Este link é individual, de uso único e válido por <strong>${params.expiresMinutes} minutos</strong>.
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #94A3B8; line-height: 1.5;">
                      Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá inalterada.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Link Alternativo -->
              <div style="margin-bottom: 28px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">
                  Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:
                </p>
                <div style="padding: 12px 14px; background-color: #0A0F1D; border: 1px solid #1E293B; border-radius: 8px; word-break: break-all; line-height: 1.5;">
                  <a href="${escapeHtml(params.resetUrl)}" target="_blank" rel="noopener noreferrer" style="color: #818CF8; font-size: 12px; text-decoration: underline; word-break: break-all;">
                    ${escapeHtml(params.resetUrl)}
                  </a>
                </div>
              </div>

              <!-- Rodapé Institucional -->
              <div style="border-top: 1px solid #1F2937; padding-top: 24px; text-align: center;">
                <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #9CA3AF;">
                  HoraCerta — Controle simples da sua jornada
                </p>
                <p style="margin: 0 0 12px 0; font-size: 12px; color: #6B7280;">
                  Esta é uma mensagem automática de segurança.
                </p>
                <p style="margin: 0; font-size: 11px; color: #4B5563;">
                  &copy; ${currentYear} HoraCerta. Todos os direitos reservados.
                </p>
              </div>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html, text };
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
        host: env.SMTP_HOST.trim(),
        port,
        secure,
        auth: {
          user: env.SMTP_USER.trim(),
          pass: env.SMTP_PASSWORD.trim(),
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
   * Valida a conectividade e autenticação com o servidor SMTP sem enviar e-mails
   */
  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Transporter SMTP não inicializado ou credenciais ausentes.' };
    }
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
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
   * Envia o e-mail de recuperação de senha com remetente institucional e template profissional
   */
  async sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<MailSendResult> {
    const { subject, html, text } = buildPasswordResetEmailTemplate(params);
    const fromAddress = env.SMTP_FROM?.trim() || env.SMTP_USER?.trim() || 'nao-responda@horacerta.local';
    const from = {
      name: 'HoraCerta',
      address: fromAddress,
    };

    const mailOptions: SendMailOptions = { from, to: params.to, subject, html, text };
    const isProduction = process.env.NODE_ENV === 'production';

    // Envio real quando SMTP configurado ou com transporte explícito fornecido
    if (this.isSmtpConfigured() || this.transporter) {
      if (!this.transporter) {
        throw new Error('Transporter SMTP não inicializado.');
      }

      try {
        const info = await this.transporter.sendMail({
          from,
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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const mailService = new MailService();
