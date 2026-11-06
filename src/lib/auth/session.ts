import { SignJWT, jwtVerify } from 'jose';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
}

const secretKey = process.env.SESSION_SECRET || 'mailbox-order-manager-super-secret-key-at-least-32-chars-long';
const key = new TextEncoder().encode(secretKey);

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as 'CUSTOMER' | 'ADMIN',
    };
  } catch {
    return null;
  }
}
