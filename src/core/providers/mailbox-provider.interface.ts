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
  provisionMailbox(email: string): Promise<ProvisionMailboxResult>;
  provisionMailboxes(emails: string[]): Promise<ProvisionMailboxResult[]>;
}

