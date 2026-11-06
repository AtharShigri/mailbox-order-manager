import { prisma } from '@/server/db/client';
import {
  OrderStatus,
  MailboxProvider,
  MailboxStatus,
  Prisma,
} from '@prisma/client';

export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    mailboxes: true;
    auditLogs: true;
    customer: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
  };
}>;

export interface CreateOrderParams {
  customerId: string;
  domain: string;
  provider: MailboxProvider;
  mailboxCount: number;
  idempotencyKey: string;
  actorId: string;
}

export interface ListOrdersParams {
  customerId?: string;
  status?: OrderStatus;
  provider?: MailboxProvider;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class OrderRepository {
  async findById(id: string): Promise<OrderWithDetails | null> {
    return prisma.order.findUnique({
      where: { id },
      include: {
        mailboxes: { orderBy: { createdAt: 'asc' } },
        auditLogs: { orderBy: { createdAt: 'asc' } },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findByIdempotencyKey(
    customerId: string,
    idempotencyKey: string
  ): Promise<OrderWithDetails | null> {
    return prisma.order.findUnique({
      where: {
        customerId_idempotencyKey: {
          customerId,
          idempotencyKey,
        },
      },
      include: {
        mailboxes: { orderBy: { createdAt: 'asc' } },
        auditLogs: { orderBy: { createdAt: 'asc' } },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async createWithMailboxesAndAudit(params: CreateOrderParams): Promise<OrderWithDetails> {
    return prisma.$transaction(async (tx) => {
      // 1. Create order in PENDING status
      const order = await tx.order.create({
        data: {
          customerId: params.customerId,
          domain: params.domain,
          provider: params.provider,
          mailboxCount: params.mailboxCount,
          idempotencyKey: params.idempotencyKey,
          status: OrderStatus.PENDING,
        },
      });

      // 2. Generate initial mailbox records
      const mailboxData = Array.from({ length: params.mailboxCount }).map((_, idx) => ({
        orderId: order.id,
        email: `mailbox${idx + 1}@${params.domain}`,
        status: MailboxStatus.PENDING,
      }));

      await tx.mailbox.createMany({
        data: mailboxData,
      });

      // 3. Create initial audit log
      await tx.auditLog.create({
        data: {
          orderId: order.id,
          previousStatus: null,
          newStatus: OrderStatus.PENDING,
          actorId: params.actorId,
          description: `Order created for ${params.mailboxCount} ${params.provider} mailboxes on domain '${params.domain}'`,
        },
      });

      // 4. Fetch full hydrated order
      const hydrated = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          mailboxes: { orderBy: { createdAt: 'asc' } },
          auditLogs: { orderBy: { createdAt: 'asc' } },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return hydrated;
    });
  }

  async updateStatusWithAudit(params: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    actorId?: string;
    description: string;
  }): Promise<OrderWithDetails> {
    return prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id: params.orderId },
        data: {
          status: params.toStatus,
          lockedAt: null, // Release worker lock if any
        },
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          orderId: updated.id,
          previousStatus: params.fromStatus,
          newStatus: params.toStatus,
          actorId: params.actorId,
          description: params.description,
        },
      });

      // Return hydrated order
      return tx.order.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          mailboxes: { orderBy: { createdAt: 'asc' } },
          auditLogs: { orderBy: { createdAt: 'asc' } },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
    });
  }

  async list(params: ListOrdersParams): Promise<PaginatedResult<OrderWithDetails>> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.provider ? { provider: params.provider } : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          mailboxes: { orderBy: { createdAt: 'asc' } },
          auditLogs: { orderBy: { createdAt: 'asc' } },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const orderRepository = new OrderRepository();
