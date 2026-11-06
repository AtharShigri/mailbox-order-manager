import { getCurrentUser } from '@/server/auth/session';
import { jsonSuccess, jsonError } from '@/server/api/response';

export async function GET() {
  try {
    const user = await getCurrentUser();
    return jsonSuccess({ user });
  } catch (error) {
    return jsonError(error);
  }
}
