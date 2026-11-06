import { describe, it, expect, beforeAll } from 'vitest';
import { orderService } from '../../server/services/order.service';
import { userRepository, SafeUser } from '../../server/repositories/user.repository';
import { orderRepository } from '../../server/repositories/order.repository';
import { OrderStatus, MailboxProvider } from '@prisma/client';
import { ConflictError, ForbiddenError, ValidationError } from '../../core/errors';

describe('Order Creation & State Machine Integration Tests (Real DB)', () => {
  let customer1: SafeUser;
  let customer2: SafeUser;
  let admin: SafeUser;

  beforeAll(async () => {
    customer1 = (await userRepository.findSafeByEmail('customer1@example.com'))!;
    customer2 = (await userRepository.findSafeByEmail('customer2@example.com'))!;
    admin = (await userRepository.findSafeByEmail('admin@example.com'))!;

    expect(customer1).toBeDefined();
    expect(customer2).toBeDefined();
    expect(admin).toBeDefined();
  });

  it('creates an order with mailboxes and audit log atomically', async () => {
    const key = `test-order-create-${Date.now()}`;
    const { order, isExisting } = await orderService.createOrder(
      customer1.id,
      {
        domain: 'acme-saas.com',
        provider: 'GOOGLE',
        mailboxCount: 5,
      },
      key,
      customer1.id
    );

    expect(isExisting).toBe(false);
    expect(order.id).toBeDefined();
    expect(order.customerId).toBe(customer1.id);
    expect(order.domain).toBe('acme-saas.com');
    expect(order.provider).toBe(MailboxProvider.GOOGLE);
    expect(order.mailboxCount).toBe(5);
    expect(order.status).toBe(OrderStatus.PENDING);

    // Verify mailboxes generated
    expect(order.mailboxes).toHaveLength(5);
    expect(order.mailboxes[0]?.email).toBe('mailbox1@acme-saas.com');
    expect(order.mailboxes[4]?.email).toBe('mailbox5@acme-saas.com');

    // Verify initial audit log
    expect(order.auditLogs).toHaveLength(1);
    expect(order.auditLogs[0]?.previousStatus).toBeNull();
    expect(order.auditLogs[0]?.newStatus).toBe(OrderStatus.PENDING);
    expect(order.auditLogs[0]?.actorId).toBe(customer1.id);
  });

  it('enforces idempotency: returns existing order for identical key and payload', async () => {
    const key = `idempotent-key-${Date.now()}`;
    const payload = {
      domain: 'stark-corp.org',
      provider: 'MICROSOFT',
      mailboxCount: 3,
    };

    // First request
    const firstCall = await orderService.createOrder(customer1.id, payload, key, customer1.id);
    expect(firstCall.isExisting).toBe(false);

    // Second request with same key and payload
    const secondCall = await orderService.createOrder(customer1.id, payload, key, customer1.id);
    expect(secondCall.isExisting).toBe(true);
    expect(secondCall.order.id).toBe(firstCall.order.id);
    expect(secondCall.order.mailboxes).toHaveLength(3);
  });

  it('rejects reuse of the same idempotency key with different payload', async () => {
    const key = `idempotent-mismatch-${Date.now()}`;

    // Initial creation
    await orderService.createOrder(
      customer1.id,
      {
        domain: 'initial-domain.com',
        provider: 'GOOGLE',
        mailboxCount: 2,
      },
      key,
      customer1.id
    );

    // Attempting same key with different mailbox count
    await expect(
      orderService.createOrder(
        customer1.id,
        {
          domain: 'initial-domain.com',
          provider: 'GOOGLE',
          mailboxCount: 10,
        },
        key,
        customer1.id
      )
    ).rejects.toThrow(ConflictError);
  });

  it('scopes idempotency keys to individual customers', async () => {
    const sharedKey = `shared-client-uuid-${Date.now()}`;

    // Customer 1 creates order with this key
    const order1 = await orderService.createOrder(
      customer1.id,
      {
        domain: 'customer1-domain.com',
        provider: 'GOOGLE',
        mailboxCount: 2,
      },
      sharedKey,
      customer1.id
    );

    // Customer 2 creates order with the EXACT SAME key (scoped per customer)
    const order2 = await orderService.createOrder(
      customer2.id,
      {
        domain: 'customer2-domain.com',
        provider: 'MICROSOFT',
        mailboxCount: 4,
      },
      sharedKey,
      customer2.id
    );

    expect(order1.order.id).not.toBe(order2.order.id);
    expect(order1.order.customerId).toBe(customer1.id);
    expect(order2.order.customerId).toBe(customer2.id);
  });

  it('rejects invalid inputs via Zod validation', async () => {
    const key = `invalid-input-${Date.now()}`;

    // Mailbox count > 50
    await expect(
      orderService.createOrder(
        customer1.id,
        {
          domain: 'valid-domain.com',
          provider: 'GOOGLE',
          mailboxCount: 99,
        },
        key,
        customer1.id
      )
    ).rejects.toThrow(ValidationError);

    // Mailbox count < 1 (0)
    await expect(
      orderService.createOrder(
        customer1.id,
        {
          domain: 'valid-domain.com',
          provider: 'GOOGLE',
          mailboxCount: 0,
        },
        `${key}-zero`,
        customer1.id
      )
    ).rejects.toThrow(ValidationError);

    // Invalid provider
    await expect(
      orderService.createOrder(
        customer1.id,
        {
          domain: 'valid-domain.com',
          provider: 'UNSUPPORTED_PROVIDER',
          mailboxCount: 5,
        },
        `${key}-provider`,
        customer1.id
      )
    ).rejects.toThrow(ValidationError);

    // Invalid domain
    await expect(
      orderService.createOrder(
        customer1.id,
        {
          domain: 'not-a-domain',
          provider: 'GOOGLE',
          mailboxCount: 5,
        },
        key,
        customer1.id
      )
    ).rejects.toThrow(ValidationError);
  });

  it('handles admin retry transition (FAILED -> PENDING) and logs audit event', async () => {
    const key = `failed-retry-order-${Date.now()}`;

    // 1. Create order
    const { order } = await orderService.createOrder(
      customer1.id,
      {
        domain: 'retry-test.com',
        provider: 'GOOGLE',
        mailboxCount: 2,
      },
      key,
      customer1.id
    );

    // 2. Simulate worker transition: PENDING -> PROVISIONING -> FAILED
    await orderRepository.updateStatusWithAudit({
      orderId: order.id,
      fromStatus: OrderStatus.PENDING,
      toStatus: OrderStatus.PROVISIONING,
      actorId: 'WORKER',
      description: 'Worker started provisioning',
    });

    await orderRepository.updateStatusWithAudit({
      orderId: order.id,
      fromStatus: OrderStatus.PROVISIONING,
      toStatus: OrderStatus.FAILED,
      actorId: 'WORKER',
      description: 'Provisioning failed: simulated provider error',
    });

    // 3. Customer attempts to retry (must be rejected)
    await expect(orderService.retryOrder(order.id, customer1)).rejects.toThrow(ForbiddenError);

    // 4. Admin retries (must succeed)
    const retriedOrder = await orderService.retryOrder(order.id, admin);
    expect(retriedOrder.status).toBe(OrderStatus.PENDING);

    // Verify audit logs history
    expect(retriedOrder.auditLogs.length).toBeGreaterThanOrEqual(4);
    const latestLog = retriedOrder.auditLogs[retriedOrder.auditLogs.length - 1];
    expect(latestLog?.previousStatus).toBe(OrderStatus.FAILED);
    expect(latestLog?.newStatus).toBe(OrderStatus.PENDING);
    expect(latestLog?.actorId).toBe(admin.id);
  });
});
