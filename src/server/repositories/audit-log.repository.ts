import { prisma } from '@/server/db/client';
import { AuditLog, OrderStatus, Prisma } from '@prisma/client';

export interface CreateAuditLogData {
  orderId: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  actorId?: string;
  description: string;
}

export class AuditLogRepository {
  async create(
    data: CreateAuditLogData,
    tx?: Prisma.TransactionClient
  ): Promise<AuditLog> {
    const db = tx ?? prisma;
    return db.auditLog.create({
      data: {
        orderId: data.orderId,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        actorId: data.actorId,
        description: data.description,
      },
    });
  }

  async findByOrderId(orderId: string): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
