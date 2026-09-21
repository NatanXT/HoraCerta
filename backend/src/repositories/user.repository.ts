import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }
}

export const userRepository = new UserRepository();
