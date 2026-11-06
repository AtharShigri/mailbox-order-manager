import { clearSessionCookieOnResponse } from '@/server/auth/session';
import { jsonSuccess, jsonError } from '@/server/api/response';

export async function POST() {
  try {
    const res = jsonSuccess({ message: 'Logged out successfully' });
    clearSessionCookieOnResponse(res);
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
