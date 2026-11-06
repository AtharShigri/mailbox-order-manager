import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SessionPayload } from '@/lib/auth/session';
import { userRepository, SafeUser } from '@/server/repositories/user.repository';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { UserRole } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'mailbox_session';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function getSessionCookie(req?: NextRequest): Promise<string | undefined> {
  if (req) {
    const fromReq = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (fromReq) return fromReq;

    // Fallback: Check Cookie header manually if not parsed in test environment
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      if (match) {
        return match.substring(`${SESSION_COOKIE_NAME}=`.length);
      }
    }
  }

  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export function setSessionCookieOnResponse(
  response: NextResponse,
  token: string
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}

export function clearSessionCookieOnResponse(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

export async function setSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  } catch {
    // If called outside server action context, silently continue
  }
}

export async function clearSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
    });
  } catch {
    // If called outside server action context, silently continue
  }
}

export async function getSessionPayload(req?: NextRequest): Promise<SessionPayload | null> {
  const token = await getSessionCookie(req);
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser(req?: NextRequest): Promise<SafeUser | null> {
  const payload = await getSessionPayload(req);
  if (!payload?.userId) return null;

  return userRepository.findById(payload.userId);
}

export async function requireUser(req?: NextRequest): Promise<SafeUser> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new UnauthorizedError('Authentication required to access this resource');
  }
  return user;
}

export async function requireRole(
  allowedRoles: UserRole | UserRole[],
  req?: NextRequest
): Promise<SafeUser> {
  const user = await requireUser(req);
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
