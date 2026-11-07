import { MailboxProvider } from '@prisma/client';

export interface ProvisionMailboxResult {
  email: string;
  success: boolean;
  status: 'ACTIVE' | 'FAILED';
  errorMessage?: string;
  providerMailboxId?: string;
}

export interface IMailboxProvider {
  readonly providerName: MailboxProvider;
  provisionMailbox(email: string, context?: { isRetry?: boolean }): Promise<ProvisionMailboxResult>;
  provisionMailboxes(emails: string[], context?: { isRetry?: boolean }): Promise<ProvisionMailboxResult[]>;
}

