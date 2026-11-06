import { NextRequest } from 'next/server';
import { authService } from '@/server/services/auth.service';
import { setSessionCookie } from '@/server/auth/session';
import { jsonSuccess, jsonError } from '@/server/api/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, token } = await authService.login(body);

    await setSessionCookie(token);

    return jsonSuccess({ user });
  } catch (error) {
    return jsonError(error);
  }
}

