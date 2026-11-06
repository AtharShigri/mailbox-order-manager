import { NextRequest } from 'next/server';
import { authService } from '@/server/services/auth.service';
import { setSessionCookieOnResponse } from '@/server/auth/session';
import { jsonSuccess, jsonError } from '@/server/api/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, token } = await authService.login(body);

    const res = jsonSuccess({ user });
    setSessionCookieOnResponse(res, token);

    return res;
  } catch (error) {
    return jsonError(error);
  }
}
