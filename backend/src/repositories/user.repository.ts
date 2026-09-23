import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async updateName(id: string, name: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { name },
    });
  }
}

export const userRepository = new UserRepository();
