import { cookies } from 'next/headers';
import { verifySessionToken, SessionPayload } from '@/lib/auth/session';
import { userRepository, SafeUser } from '@/server/repositories/user.repository';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { UserRole } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'mailbox_session';

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const payload = await getSessionPayload();
  if (!payload?.userId) return null;

  return userRepository.findById(payload.userId);
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError('Authentication required to access this resource');
  }
  return user;
}

export async function requireRole(allowedRoles: UserRole | UserRole[]): Promise<SafeUser> {
  const user = await requireUser();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw new ForbiddenError(`Forbidden: requires role ${roles.join(' or ')}`);
  }

  return user;
}

export function assertCustomerOwnsOrder(orderCustomerId: string, currentUser: SafeUser): void {
  if (currentUser.role === UserRole.ADMIN) {
    return; // Admin can access any order
  }

  if (currentUser.id !== orderCustomerId) {
    throw new ForbiddenError('Access denied: You cannot view or modify another customer’s order');
  }
}
