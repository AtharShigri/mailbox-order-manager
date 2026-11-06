import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { orderService } from '@/server/services/order.service';
import { jsonSuccess, jsonError } from '@/server/api/response';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser();
    const idempotencyKey = request.headers.get('idempotency-key');
    const body = await request.json();

    const { order, isExisting } = await orderService.createOrder(
      currentUser.id,
      body,
      idempotencyKey,
      currentUser.id
    );

    // Return 200 for idempotent duplicate replay, 201 for fresh creation
    return jsonSuccess({ order, idempotentReplay: isExisting }, isExisting ? 200 : 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser();
    const { searchParams } = new URL(request.url);

    const query = {
      status: searchParams.get('status') || undefined,
      provider: searchParams.get('provider') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const result = await orderService.listOrders(query, currentUser);
    return jsonSuccess(result);
  } catch (error) {
    return jsonError(error);
  }
}
