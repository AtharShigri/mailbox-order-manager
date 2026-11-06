import { userRepository, UserRepository, SafeUser } from '@/server/repositories/user.repository';
import { verifyPassword } from '@/lib/auth/password';
import { signSessionToken } from '@/lib/auth/session';
import { loginSchema, LoginInput } from '@/lib/validations/auth.schema';
import { ValidationError, UnauthorizedError } from '@/core/errors';

export class AuthService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  async login(input: LoginInput): Promise<{ user: SafeUser; token: string }> {
    const parseResult = loginSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError('Invalid login credentials', parseResult.error.flatten().fieldErrors);
    }

    const { email, password } = parseResult.data;
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const token = await signSessionToken({
      userId: safeUser.id,
      email: safeUser.email,
      name: safeUser.name,
      role: safeUser.role,
    });

    return { user: safeUser, token };
  }

  async getCurrentUser(userId: string): Promise<SafeUser | null> {
    return this.userRepo.findById(userId);
  }

  async getDemoUsers(): Promise<SafeUser[]> {
    return this.userRepo.listUsers();
  }
}

export const authService = new AuthService();
