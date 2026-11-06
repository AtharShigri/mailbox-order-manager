import { prisma } from '@/server/db/client';
import { User, UserRole, Prisma } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export class UserRepository {
  async findById(id: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;
    return this.toSafeUser(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findSafeByEmail(email: string): Promise<SafeUser | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    return this.toSafeUser(user);
  }

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<SafeUser> {
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name.trim(),
        passwordHash: data.passwordHash,
        role: data.role ?? UserRole.CUSTOMER,
      },
    });

    return this.toSafeUser(user);
  }

  async listUsers(role?: UserRole): Promise<SafeUser[]> {
    const where: Prisma.UserWhereInput = role ? { role } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => this.toSafeUser(u));
  }

  private toSafeUser(user: User): SafeUser {
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }
}

export const userRepository = new UserRepository();
