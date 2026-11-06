import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';
import { jsonSuccess, jsonError } from '@/server/api/response';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await requireUser(request);
    const { id } = await context.params;

    const order = await orderService.getOrder(id, currentUser);
    return jsonSuccess({ order });
  } catch (error) {
    return jsonError(error);
  }
}
