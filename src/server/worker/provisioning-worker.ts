import {
  OrderRepository,
  orderRepository,
  OrderWithDetails,
} from '@/server/repositories/order.repository';
import { getMailboxProvider, ProviderOptions } from '@/core/providers';
import { OrderStateMachine } from '@/core/state-machine';
import { OrderStatus, MailboxStatus } from '@prisma/client';

export interface WorkerOptions {
  pollIntervalMs?: number;
  providerOptions?: ProviderOptions;
}

export class ProvisioningWorker {
  private isRunning = false;
  private readonly pollIntervalMs: number;
  private readonly providerOptions?: ProviderOptions;

  constructor(
    private readonly orderRepo: OrderRepository = orderRepository,
    options?: WorkerOptions
  ) {
    this.pollIntervalMs =
      options?.pollIntervalMs ??
      (process.env.WORKER_POLL_INTERVAL_MS
        ? parseInt(process.env.WORKER_POLL_INTERVAL_MS, 10)
        : 2000);
    this.providerOptions = options?.providerOptions;
  }

  /**
   * Processes a single pending order if available.
   * Returns true if an order was claimed and processed, false if no pending order existed.
   */
  async processNextOrder(targetOrderId?: string): Promise<boolean> {
    // 1. Atomically claim order using FOR UPDATE SKIP LOCKED & transition PENDING -> PROVISIONING
    const order = await this.orderRepo.claimNextPendingOrder(targetOrderId);
    if (!order) {
      return false;
    }

    console.log(
      `[Worker] Claimed order ${order.id} for domain ${order.domain} (${order.provider}, ${order.mailboxes.length} mailboxes)`
    );

    try {
      await this.provisionOrderMailboxes(order);
      return true;
    } catch (error) {
      console.error(`[Worker] Unexpected error processing order ${order.id}:`, error);

      // Failsafe: transition PROVISIONING -> FAILED on unexpected crash
      const errorMessage = error instanceof Error ? error.message : 'Unknown internal worker failure';
      await this.orderRepo.updateStatusWithAudit({
        orderId: order.id,
        fromStatus: OrderStatus.PROVISIONING,
        toStatus: OrderStatus.FAILED,
        actorId: 'SYSTEM_WORKER',
        description: `Unexpected worker execution error: ${errorMessage}`,
      });
      return true;
    }
  }

  private async provisionOrderMailboxes(order: OrderWithDetails): Promise<void> {
    const isRetry = order.auditLogs.some((l) =>
      l.description.toLowerCase().includes('retry')
    );
    const provider = getMailboxProvider(order.provider, this.providerOptions);
    let anyFailed = false;
    let failedCount = 0;

    for (const mailbox of order.mailboxes) {
      console.log(`[Worker] Provisioning ${mailbox.email} via ${provider.providerName}...`);

      const result = await provider.provisionMailbox(mailbox.email, { isRetry });

      const mailboxStatus = result.status === 'ACTIVE' ? MailboxStatus.ACTIVE : MailboxStatus.FAILED;
      if (mailboxStatus === MailboxStatus.FAILED) {
        anyFailed = true;
        failedCount++;
      }

      await this.orderRepo.updateMailboxStatus(
        mailbox.id,
        mailboxStatus,
        result.errorMessage
      );

      console.log(
        `[Worker] Mailbox ${mailbox.email} -> ${mailboxStatus}${
          result.errorMessage ? ` (${result.errorMessage})` : ''
        }`
      );
    }

    // Determine final target state
    const finalStatus: OrderStatus = anyFailed ? OrderStatus.FAILED : OrderStatus.ACTIVE;

    // Validate transition via pure Domain State Machine
    OrderStateMachine.validate({
      from: OrderStatus.PROVISIONING,
      to: finalStatus,
      actorId: 'SYSTEM_WORKER',
    });

    const description =
      finalStatus === OrderStatus.ACTIVE
        ? `All ${order.mailboxes.length} mailboxes successfully provisioned with ${order.provider}`
        : `Provisioning failed: ${failedCount} of ${order.mailboxes.length} mailboxes failed during provider execution`;

    await this.orderRepo.updateStatusWithAudit({
      orderId: order.id,
      fromStatus: OrderStatus.PROVISIONING,
      toStatus: finalStatus,
      actorId: 'SYSTEM_WORKER',
      description,
    });

    console.log(`[Worker] Order ${order.id} finished with status ${finalStatus}`);
  }

  /**
   * Starts continuous polling loop.
   */
  async start(): Promise<void> {
    this.isRunning = true;
    console.log(`[Worker] Mailbox Provisioning Worker started (polling every ${this.pollIntervalMs}ms)...`);

    while (this.isRunning) {
      try {
        const hadWork = await this.processNextOrder();
        if (!hadWork && this.isRunning) {
          await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        }
      } catch (err) {
        console.error('[Worker] Polling loop error:', err);
        if (this.isRunning) {
          await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        }
      }
    }

    console.log('[Worker] Worker shut down gracefully.');
  }

  stop(): void {
    this.isRunning = false;
  }
}
