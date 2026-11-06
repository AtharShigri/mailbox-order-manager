import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { jsonSuccess, jsonError } from '@/server/api/response';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    return jsonSuccess({ user });
  } catch (error) {
    return jsonError(error);
  }
}
