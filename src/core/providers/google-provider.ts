import { MailboxProvider } from '@prisma/client';
import {
  IMailboxProvider,
  ProvisionMailboxResult,
} from './mailbox-provider.interface';

export interface ProviderOptions {
  failureRate?: number;
  delayMs?: number;
}

export class GoogleProvider implements IMailboxProvider {
  readonly providerName = MailboxProvider.GOOGLE;
  private readonly failureRate: number;
  private readonly delayMs: number;

  constructor(options?: ProviderOptions) {
    this.failureRate =
      options?.failureRate ??
      (process.env.PROVIDER_FAILURE_RATE ? parseFloat(process.env.PROVIDER_FAILURE_RATE) : 0.2);
    this.delayMs =
      options?.delayMs ??
      (process.env.PROVIDER_BASE_DELAY_MS ? parseInt(process.env.PROVIDER_BASE_DELAY_MS, 10) : 1200);
  }

  async provisionMailbox(email: string): Promise<ProvisionMailboxResult> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    // Simulate 20% random failure
    const isFailure = Math.random() < this.failureRate;

    if (isFailure) {
      const errorReasons = [
        'Google Workspace API: Domain verification check failed',
        'Google Workspace API: Organization seat quota exceeded',
        'Google Workspace API: Rate limit exceeded during user provisioning',
        'Google Workspace API: Temporary service unavailable (503)',
      ];
      const errorMessage = errorReasons[Math.floor(Math.random() * errorReasons.length)]!;

      return {
        email,
        success: false,
        status: 'FAILED',
        errorMessage,
      };
    }

    const randomId = Math.random().toString(36).substring(2, 10);
    return {
      email,
      success: true,
      status: 'ACTIVE',
      providerMailboxId: `gsuite_usr_${randomId}`,
    };
  }

  async provisionMailboxes(emails: string[]): Promise<ProvisionMailboxResult[]> {
    const results: ProvisionMailboxResult[] = [];
    for (const email of emails) {
      const res = await this.provisionMailbox(email);
      results.push(res);
    }
    return results;
  }
}

