import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';
import { jsonSuccess, jsonError } from '@/server/api/response';
import { UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireRole(UserRole.ADMIN, request);
    const { searchParams } = new URL(request.url);

    const query = {
      status: searchParams.get('status') || undefined,
      provider: searchParams.get('provider') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const result = await orderService.listOrders(query, adminUser);
    return jsonSuccess(result);
  } catch (error) {
    return jsonError(error);
  }
}
