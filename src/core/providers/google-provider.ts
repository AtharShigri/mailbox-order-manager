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
  private readonly hasExplicitFailureRate: boolean;

  constructor(options?: ProviderOptions) {
    this.hasExplicitFailureRate = options?.failureRate !== undefined;
    this.failureRate =
      options?.failureRate ??
      (process.env.PROVIDER_FAILURE_RATE ? parseFloat(process.env.PROVIDER_FAILURE_RATE) : 0.2);
    this.delayMs =
      options?.delayMs ??
      (process.env.PROVIDER_BASE_DELAY_MS ? parseInt(process.env.PROVIDER_BASE_DELAY_MS, 10) : 1200);
  }

  async provisionMailbox(email: string, context?: { isRetry?: boolean }): Promise<ProvisionMailboxResult> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    // Determine failure:
    // 1. If failureRate is explicitly configured in options, respect it (used by tests)
    // 2. Demo helper: if email contains 'fail', fail initially, then succeed on retry
    // 3. Otherwise use standard random failureRate (default 20%)
    let isFailure: boolean;
    if (this.hasExplicitFailureRate) {
      isFailure = Math.random() < this.failureRate;
    } else if (email.toLowerCase().includes('fail')) {
      isFailure = !context?.isRetry;
    } else {
      isFailure = Math.random() < this.failureRate;
    }

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

  async provisionMailboxes(
    emails: string[],
    context?: { isRetry?: boolean }
  ): Promise<ProvisionMailboxResult[]> {
    const results: ProvisionMailboxResult[] = [];
    for (const email of emails) {
      const res = await this.provisionMailbox(email, context);
      results.push(res);
    }
    return results;
  }
}

