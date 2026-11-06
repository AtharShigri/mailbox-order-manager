import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';
import { jsonSuccess, jsonError } from '@/server/api/response';
import { UserRole } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const adminUser = await requireRole(UserRole.ADMIN, request);
    const { id } = await context.params;

    const order = await orderService.retryOrder(id, adminUser);
    return jsonSuccess({ order });
  } catch (error) {
    return jsonError(error);
  }
}

