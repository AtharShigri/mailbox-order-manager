import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '../../lib/auth/password';
import { signSessionToken, verifySessionToken } from '../../lib/auth/session';
import { assertCustomerOwnsOrder } from '../../server/auth/session';
import { AuthService } from '../../server/services/auth.service';
import { UserRepository, SafeUser } from '../../server/repositories/user.repository';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../core/errors';
import { UserRole } from '@prisma/client';

describe('Password Utilities', () => {
  it('should hash a password and verify it correctly', async () => {
    const raw = 'SecurePassword123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(await verifyPassword(raw, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });
});

describe('Session Token Utilities', () => {
  it('should sign and verify valid session tokens', async () => {
    const payload = {
      userId: 'user_123',
      email: 'customer1@example.com',
      name: 'Customer One',
      role: 'CUSTOMER' as const,
    };

    const token = await signSessionToken(payload);
    expect(token).toBeDefined();

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('user_123');
    expect(verified?.email).toBe('customer1@example.com');
    expect(verified?.role).toBe('CUSTOMER');
  });

  it('should return null for malformed tokens', async () => {
    const verified = await verifySessionToken('invalid.jwt.token');
    expect(verified).toBeNull();
  });
});

describe('Authorization & Tenant Isolation (assertCustomerOwnsOrder)', () => {
  const customerUser: SafeUser = {
    id: 'cust_abc',
    name: 'Customer ABC',
    email: 'abc@example.com',
    role: UserRole.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser: SafeUser = {
    id: 'admin_xyz',
    name: 'Admin XYZ',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should allow customer to access their own order', () => {
    expect(() => assertCustomerOwnsOrder('cust_abc', customerUser)).not.toThrow();
  });

  it('should reject customer accessing another customer order with ForbiddenError', () => {
    expect(() => assertCustomerOwnsOrder('cust_other', customerUser)).toThrow(ForbiddenError);
  });

  it('should allow admin to access any customer order', () => {
    expect(() => assertCustomerOwnsOrder('cust_other', adminUser)).not.toThrow();
  });
});

describe('AuthService (Service Layer)', () => {
  let authService: AuthService;
  let mockUserRepo: UserRepository;

  beforeEach(() => {
    mockUserRepo = new UserRepository();
    authService = new AuthService(mockUserRepo);
  });

  it('should reject invalid input schemas', async () => {
    await expect(
      authService.login({ email: 'not-an-email', password: '123' })
    ).rejects.toThrow(ValidationError);
  });

  it('should reject non-existent email', async () => {
    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(null);

    await expect(
      authService.login({ email: 'unknown@example.com', password: 'Password123!' })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should reject invalid password', async () => {
    const hashedPassword = await hashPassword('CorrectPassword123!');
    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue({
      id: 'usr_1',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: hashedPassword,
      role: UserRole.CUSTOMER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      authService.login({ email: 'test@example.com', password: 'WrongPassword!' })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should log in successfully and never expose passwordHash', async () => {
    const rawPassword = 'CorrectPassword123!';
    const hashedPassword = await hashPassword(rawPassword);
    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue({
      id: 'usr_1',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: hashedPassword,
      role: UserRole.CUSTOMER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await authService.login({ email: 'test@example.com', password: rawPassword });

    expect(result.token).toBeDefined();
    expect(result.user.id).toBe('usr_1');
    expect(result.user.email).toBe('test@example.com');
    // Verify passwordHash is never leaked
    expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});
