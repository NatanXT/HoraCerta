import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';
import { hashPassword, comparePassword } from '../utils/auth';
import { AppError } from '../errors/app-error';

export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
}

export class AuthService {
  async register(data: RegisterInput): Promise<UserResponseDTO> {
    const normalizedEmail = data.email.trim().toLowerCase();

    // 1. Check if legacy user claim applies
    const legacyUser = await prisma.user.findUnique({
      where: { email: env.DEFAULT_USER_EMAIL },
    });

    // Claim legacy user if legacy user exists without password
    if (legacyUser && legacyUser.passwordHash === null) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser && existingUser.id !== legacyUser.id) {
        throw new AppError('Este e-mail já está em uso.', 400, 'EMAIL_IN_USE');
      }

      const passwordHash = await hashPassword(data.password);

      const updatedUser = await prisma.user.update({
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
      };
    }

    // 2. Standard registration check for existing email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('Este e-mail já está em uso.', 400, 'EMAIL_IN_USE');
    }

    const passwordHash = await hashPassword(data.password);

    const newUser = await prisma.user.create({
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
    };
  }

  async login(data: LoginInput): Promise<UserResponseDTO> {
    const normalizedEmail = data.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
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
    };
  }

  async getMe(userId: string): Promise<UserResponseDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}

export const authService = new AuthService();
