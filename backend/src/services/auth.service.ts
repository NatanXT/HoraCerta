import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from '../schemas/auth.schema';
import { hashPassword, comparePassword } from '../utils/auth';
import { mailService } from './mail.service';
import { AppError } from '../errors/app-error';

export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  authVersion?: number;
}

export class AuthService {
  constructor(private db: any = prisma) {}

  async register(data: RegisterInput): Promise<UserResponseDTO> {
    const normalizedEmail = data.email.trim().toLowerCase();

    // 1. Check if legacy user claim applies
    const legacyUser = await this.db.user.findUnique({
      where: { email: env.DEFAULT_USER_EMAIL },
    });

    // Claim legacy user if legacy user exists without password
    if (legacyUser && legacyUser.passwordHash === null) {
      const existingUser = await this.db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser && existingUser.id !== legacyUser.id) {
        throw new AppError('Este e-mail já está em uso.', 400, 'EMAIL_IN_USE');
      }

      const passwordHash = await hashPassword(data.password);

      const updatedUser = await this.db.user.update({
        where: { id: legacyUser.id },
        data: {
          name: data.name.trim(),
          email: normalizedEmail,
          passwordHash,
        },
      });

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        authVersion: updatedUser.authVersion ?? 0,
      };
    }

    // 2. Standard registration check for existing email
    const existingUser = await this.db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('Este e-mail já está em uso.', 400, 'EMAIL_IN_USE');
    }

    const passwordHash = await hashPassword(data.password);

    const newUser = await this.db.user.create({
      data: {
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
    });

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      authVersion: newUser.authVersion ?? 0,
    };
  }

  async login(data: LoginInput): Promise<UserResponseDTO> {
    const normalizedEmail = data.email.trim().toLowerCase();

    const user = await this.db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('E-mail ou senha inválidos.', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('E-mail ou senha inválidos.', 401, 'INVALID_CREDENTIALS');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      authVersion: user.authVersion ?? 0,
    };
  }

  async getMe(userId: string): Promise<UserResponseDTO> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      authVersion: user.authVersion ?? 0,
    };
  }

  /**
   * Solicita redefinição de senha com resposta anti-enumeração
   */
  async forgotPassword(data: ForgotPasswordInput): Promise<{ message: string }> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const genericResponse = 'Se existir uma conta com esse e-mail, você receberá as instruções de recuperação.';

    const user = await this.db.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Se o usuário não existir, responde genericamente sem revelar a ausência da conta
    if (!user) {
      return { message: genericResponse };
    }

    // 1. Gera token seguro aleatório de 32 bytes (64 caracteres hexadecimais)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 2. Expiração em 20 minutos
    const expiresMinutes = 20;
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

    // 3. Invalida tokens anteriores não utilizados do usuário
    await this.db.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    // 4. Salva o novo hash do token associado ao usuário
    await this.db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // 5. Envia o e-mail com link seguro
    const resetUrl = `${env.FRONTEND_URL}/redefinir-senha?token=${rawToken}`;
    try {
      await mailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresMinutes,
      });
    } catch (err) {
      console.error('[AuthService] Erro ao disparar e-mail de recuperação:', (err as Error).message);
    }

    return { message: genericResponse };
  }

  /**
   * Valida o token e redefine a senha do usuário, garantindo consumo atômico
   * e invalidando todas as sessões anteriores através de authVersion.
   */
  async resetPassword(data: ResetPasswordInput): Promise<{ message: string }> {
    const rawToken = data.token ? data.token.trim() : '';
    if (!rawToken) {
      throw new AppError('Token inválido, expirado ou já utilizado.', 400, 'INVALID_TOKEN');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const resetToken = await this.db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Verifica se token existe, se já foi usado ou se expirou
    if (!resetToken) {
      throw new AppError('Token inválido, expirado ou já utilizado.', 400, 'INVALID_TOKEN');
    }

    if (resetToken.usedAt !== null) {
      throw new AppError('Token inválido, expirado ou já utilizado.', 400, 'TOKEN_ALREADY_USED');
    }

    const now = new Date();
    if (resetToken.expiresAt.getTime() <= now.getTime()) {
      throw new AppError('Token inválido, expirado ou já utilizado.', 400, 'TOKEN_EXPIRED');
    }

    // Hasheia a nova senha com bcrypt
    const passwordHash = await hashPassword(data.newPassword);

    // Transação com consumo atômico e revogação de sessões via authVersion
    await this.db.$transaction(async (tx: any) => {
      const txNow = new Date();

      // 1. Consumo condicional atômico: só atualiza se usedAt for null e não tiver expirado
      const updateResult = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: txNow },
        },
        data: {
          usedAt: txNow,
        },
      });

      // Se nenhum registro foi afetado, outra requisição concorrente já consumiu o token
      if (updateResult.count !== 1) {
        throw new AppError('Token inválido, expirado ou já utilizado.', 400, 'TOKEN_ALREADY_USED');
      }

      // 2. Atualiza a senha e incrementa authVersion para revogar todos os JWTs anteriores
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 },
        },
      });

      // 3. Remove outros tokens pendentes deste usuário
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
          usedAt: null,
        },
      });
    });

    return { message: 'Senha atualizada com sucesso.' };
  }
}

export const authService = new AuthService();
