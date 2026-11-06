import { MailboxProvider } from '@prisma/client';
import {
  IMailboxProvider,
  ProvisionMailboxResult,
} from './mailbox-provider.interface';
import { ProviderOptions } from './google-provider';

export class MicrosoftProvider implements IMailboxProvider {
  readonly providerName = MailboxProvider.MICROSOFT;
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
        'Microsoft Graph API: License assignment failed for tenant',
        'Microsoft Graph API: Exchange Online mailbox creation timed out',
        'Microsoft Graph API: Tenant throttling limit reached (429)',
        'Microsoft Graph API: Principal synchronization error',
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
      providerMailboxId: `ms_o365_${randomId}`,
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
