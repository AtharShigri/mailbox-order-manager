import { clearSessionCookie } from '@/server/auth/session';
import { jsonSuccess, jsonError } from '@/server/api/response';

export async function POST() {
  try {
    await clearSessionCookie();
    return jsonSuccess({ message: 'Logged out successfully' });
  } catch (error) {
    return jsonError(error);
  }
}

