import { describe, it, expect } from 'vitest';
import { authService } from '@/server/services/auth.service';
import { DEMO_CREDENTIALS } from '../../../prisma/seed';
import { UnauthorizedError } from '@/core/errors';
import { UserRole } from '@prisma/client';

describe('Authentication Integration Tests (Real DB)', () => {
  it('should authenticate seeded admin user with demo credentials', async () => {
    const adminCred = DEMO_CREDENTIALS.find((c) => c.role === UserRole.ADMIN)!;
    const result = await authService.login({
      email: adminCred.email,
      password: adminCred.password,
    });

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(adminCred.email);
    expect(result.user.role).toBe(UserRole.ADMIN);
  });

  it('should authenticate seeded customer user with demo credentials', async () => {
    const customerCred = DEMO_CREDENTIALS.find((c) => c.email === 'customer1@example.com')!;
    const result = await authService.login({
      email: customerCred.email,
      password: customerCred.password,
    });

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(customerCred.email);
    expect(result.user.role).toBe(UserRole.CUSTOMER);
  });

  it('should reject invalid password for seeded user', async () => {
    await expect(
      authService.login({
        email: 'customer1@example.com',
        password: 'WrongPassword!',
      })
    ).rejects.toThrow(UnauthorizedError);
  });
});
