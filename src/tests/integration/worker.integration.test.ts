import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ProvisioningWorker } from '../../server/worker/provisioning-worker';
import { orderService } from '../../server/services/order.service';
import { orderRepository } from '../../server/repositories/order.repository';
import { userRepository, SafeUser } from '../../server/repositories/user.repository';
import { prisma } from '../../server/db/client';
import { OrderStatus, MailboxStatus } from '@prisma/client';

describe('Provisioning Worker Integration Tests (Real DB & Concurrency)', () => {
  let customer: SafeUser;
  let admin: SafeUser;

  beforeAll(async () => {
    customer = (await userRepository.findSafeByEmail('customer1@example.com'))!;
    admin = (await userRepository.findSafeByEmail('admin@example.com'))!;
  });

  beforeEach(async () => {
    // Clean up orders between tests for strict test isolation
    await prisma.order.deleteMany();
  });

  it('prevents concurrent workers from claiming the same order (FOR UPDATE SKIP LOCKED)', async () => {
    // 1. Create a single PENDING order
    const key = `worker-concurrency-test-${Date.now()}`;
    const { order } = await orderService.createOrder(
      customer.id,
      {
        domain: 'concurrency-domain.com',
        provider: 'GOOGLE',
        mailboxCount: 2,
      },
      key,
      customer.id
    );

    expect(order.status).toBe(OrderStatus.PENDING);

    // 2. Instantiate two parallel worker instances
    const worker1 = new ProvisioningWorker(orderRepository, {
      providerOptions: { failureRate: 0, delayMs: 50 },
    });
    const worker2 = new ProvisioningWorker(orderRepository, {
      providerOptions: { failureRate: 0, delayMs: 50 },
    });

    // 3. Race both workers simultaneously to claim the order
    const [result1, result2] = await Promise.all([
      worker1.processNextOrder(),
      worker2.processNextOrder(),
    ]);

    // Exactly one worker must claim and process it; the other gets false (skips locked row)
    const processedCount = [result1, result2].filter(Boolean).length;
    expect(processedCount).toBe(1);

    // Verify the order reached ACTIVE status
    const refreshed = await orderRepository.findById(order.id);
    expect(refreshed?.status).toBe(OrderStatus.ACTIVE);
  });

  it('provisions mailboxes to ACTIVE when provider succeeds', async () => {
    const key = `worker-success-test-${Date.now()}`;
    const { order } = await orderService.createOrder(
      customer.id,
      {
        domain: 'successful-corp.com',
        provider: 'GOOGLE',
        mailboxCount: 3,
      },
      key,
      customer.id
    );

    const worker = new ProvisioningWorker(orderRepository, {
      providerOptions: { failureRate: 0, delayMs: 0 },
    });

    const processed = await worker.processNextOrder(order.id);
    expect(processed).toBe(true);

    const updated = await orderRepository.findById(order.id);
    expect(updated?.status).toBe(OrderStatus.ACTIVE);
    expect(updated?.mailboxes).toHaveLength(3);
    for (const mb of updated!.mailboxes) {
      expect(mb.status).toBe(MailboxStatus.ACTIVE);
      expect(mb.errorMessage).toBeNull();
    }

    // Verify audit log sequence: PENDING -> PROVISIONING -> ACTIVE
    const logs = updated!.auditLogs;
    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs[logs.length - 2]?.newStatus).toBe(OrderStatus.PROVISIONING);
    expect(logs[logs.length - 1]?.newStatus).toBe(OrderStatus.ACTIVE);
  });

  it('marks order and mailbox as FAILED when provider fails', async () => {
    const key = `worker-failure-test-${Date.now()}`;
    const { order } = await orderService.createOrder(
      customer.id,
      {
        domain: 'failed-corp.com',
        provider: 'MICROSOFT',
        mailboxCount: 2,
      },
      key,
      customer.id
    );

    const worker = new ProvisioningWorker(orderRepository, {
      providerOptions: { failureRate: 1, delayMs: 0 },
    });

    const processed = await worker.processNextOrder(order.id);
    expect(processed).toBe(true);

    const updated = await orderRepository.findById(order.id);
    expect(updated?.status).toBe(OrderStatus.FAILED);
    for (const mb of updated!.mailboxes) {
      expect(mb.status).toBe(MailboxStatus.FAILED);
      expect(mb.errorMessage).toBeDefined();
    }

    const latestLog = updated!.auditLogs[updated!.auditLogs.length - 1];
    expect(latestLog?.previousStatus).toBe(OrderStatus.PROVISIONING);
    expect(latestLog?.newStatus).toBe(OrderStatus.FAILED);
  });

  it('allows admin retry to reset failed mailboxes and enables worker to succeed on retry', async () => {
    const key = `worker-retry-flow-${Date.now()}`;
    // 1. Create order
    const { order } = await orderService.createOrder(
      customer.id,
      {
        domain: 'retry-flow.com',
        provider: 'GOOGLE',
        mailboxCount: 2,
      },
      key,
      customer.id
    );

    // 2. Worker fails it
    const failingWorker = new ProvisioningWorker(orderRepository, {
      providerOptions: { failureRate: 1, delayMs: 0 },
    });
    await failingWorker.processNextOrder(order.id);

    const failedOrder = await orderRepository.findById(order.id);
    expect(failedOrder?.status).toBe(OrderStatus.FAILED);
    expect(failedOrder?.mailboxes[0]?.status).toBe(MailboxStatus.FAILED);

    // 3. Admin retries order
    const retriedOrder = await orderService.retryOrder(order.id, admin);
    expect(retriedOrder.status).toBe(OrderStatus.PENDING);
    // Mailboxes reset to PENDING with null error messages
    expect(retriedOrder.mailboxes[0]?.status).toBe(MailboxStatus.PENDING);
    expect(retriedOrder.mailboxes[0]?.errorMessage).toBeNull();

    // 4. Worker processes retried order successfully
    const successfulWorker = new ProvisioningWorker(orderRepository, {
      providerOptions: { failureRate: 0, delayMs: 0 },
    });
    const workedAgain = await successfulWorker.processNextOrder(order.id);
    expect(workedAgain).toBe(true);

    const finalOrder = await orderRepository.findById(order.id);
    expect(finalOrder?.status).toBe(OrderStatus.ACTIVE);
    expect(finalOrder?.mailboxes[0]?.status).toBe(MailboxStatus.ACTIVE);
  });
});
