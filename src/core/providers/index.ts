export interface ProvisionMailboxInput {
  domain: string;
  count: number;
}

export interface ProvisionedMailboxResult {
  email: string;
  status: 'ACTIVE' | 'FAILED';
  errorMessage?: string;
}

export interface IMailboxProviderStrategy {
  providerName: 'GOOGLE' | 'MICROSOFT';
  provisionMailboxes(input: ProvisionMailboxInput): Promise<ProvisionedMailboxResult[]>;
}

