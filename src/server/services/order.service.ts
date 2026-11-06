import {
  OrderRepository,
  orderRepository,
  OrderWithDetails,
  PaginatedResult,
} from '@/server/repositories/order.repository';
import { SafeUser } from '@/server/repositories/user.repository';
import { OrderStateMachine } from '@/core/state-machine';
import {
  createOrderSchema,
  CreateOrderInput,
  orderQuerySchema,
} from '@/lib/validations/order.schema';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '@/core/errors';
import { assertCustomerOwnsOrder } from '@/server/auth/session';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';

export class OrderService {
  constructor(private readonly orderRepo: OrderRepository = orderRepository) {}

  /**
   * Creates an order idempotently for an authenticated customer.
   */
  async createOrder(
    customerId: string,
    rawInput: unknown,
    idempotencyKey?: string | null,
    actorId?: string
  ): Promise<{ order: OrderWithDetails; isExisting: boolean }> {
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      throw new ValidationError('Missing required Idempotency-Key header');
    }

    const trimmedKey = idempotencyKey.trim();

    const parsed = createOrderSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Validation failed for order creation', parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;

    // 1. Check if an order with this idempotency key already exists for this customer
    const existing = await this.orderRepo.findByIdempotencyKey(customerId, trimmedKey);
    if (existing) {
      this.verifyIdempotencyPayloadMatch(existing, input, trimmedKey);
      return { order: existing, isExisting: true };
    }

    // 2. Attempt to create order atomically
    try {
      const order = await this.orderRepo.createWithMailboxesAndAudit({
        customerId,
        domain: input.domain,
        provider: input.provider,
        mailboxCount: input.mailboxCount,
        idempotencyKey: trimmedKey,
        actorId: actorId ?? customerId,
      });

      return { order, isExisting: false };
    } catch (error) {
      // Handle concurrent race condition (PostgreSQL unique constraint violation)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentExisting = await this.orderRepo.findByIdempotencyKey(
          customerId,
          trimmedKey
        );
        if (concurrentExisting) {
          this.verifyIdempotencyPayloadMatch(concurrentExisting, input, trimmedKey);
          return { order: concurrentExisting, isExisting: true };
        }
      }
      throw error;
    }
  }

  /**
   * Retrieves an order by ID with tenant isolation verification.
   */
  async getOrder(orderId: string, currentUser: SafeUser): Promise<OrderWithDetails> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    assertCustomerOwnsOrder(order.customerId, currentUser);
    return order;
  }

  /**
   * Lists orders with role-based filtering and pagination.
   */
  async listOrders(
    rawQuery: unknown,
    currentUser: SafeUser
  ): Promise<PaginatedResult<OrderWithDetails>> {
    const parsed = orderQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', parsed.error.flatten().fieldErrors);
    }

    const query = parsed.data;

    // Customers can ONLY see their own orders; Admins can see all
    const customerId = currentUser.role === UserRole.CUSTOMER ? currentUser.id : undefined;

    return this.orderRepo.list({
      customerId,
      status: query.status,
      provider: query.provider,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * Retries a FAILED order (Admin only), transitioning FAILED -> PENDING.
   */
  async retryOrder(orderId: string, adminUser: SafeUser): Promise<OrderWithDetails> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    // Validate transition through State Machine (enforces ADMIN role and allowed transition)
    OrderStateMachine.validate({
      from: order.status,
      to: OrderStatus.PENDING,
      actorRole: adminUser.role,
      actorId: adminUser.id,
    });

    return this.orderRepo.updateStatusWithAudit({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: OrderStatus.PENDING,
      actorId: adminUser.id,
      description: `Order retry triggered by admin (${adminUser.email})`,
    });
  }

  private verifyIdempotencyPayloadMatch(
    existing: OrderWithDetails,
    input: CreateOrderInput,
    idempotencyKey: string
  ): void {
    const isMatch =
      existing.domain.toLowerCase() === input.domain.toLowerCase() &&
      existing.provider === input.provider &&
      existing.mailboxCount === input.mailboxCount;

    if (!isMatch) {
      throw new ConflictError(
        `Idempotency-Key '${idempotencyKey}' was already used with different parameters (Existing: ${existing.provider} ${existing.mailboxCount}x on ${existing.domain}, Received: ${input.provider} ${input.mailboxCount}x on ${input.domain})`
      );
    }
  }
}

export const orderService = new OrderService();
