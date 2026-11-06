import { MailboxProvider } from '@prisma/client';
import { IMailboxProvider } from './mailbox-provider.interface';
import { GoogleProvider, ProviderOptions } from './google-provider';
import { MicrosoftProvider } from './microsoft-provider';

export class MailboxProviderStrategyFactory {
  private static readonly instances: Partial<Record<MailboxProvider, IMailboxProvider>> = {};

  static getProvider(
    provider: MailboxProvider,
    customOptions?: ProviderOptions
  ): IMailboxProvider {
    if (customOptions) {
      switch (provider) {
        case MailboxProvider.GOOGLE:
          return new GoogleProvider(customOptions);
        case MailboxProvider.MICROSOFT:
          return new MicrosoftProvider(customOptions);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    }

    if (!this.instances[provider]) {
      switch (provider) {
        case MailboxProvider.GOOGLE:
          this.instances[provider] = new GoogleProvider();
          break;
        case MailboxProvider.MICROSOFT:
          this.instances[provider] = new MicrosoftProvider();
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    }

    return this.instances[provider]!;
  }
}

export function getMailboxProvider(
  provider: MailboxProvider,
  customOptions?: ProviderOptions
): IMailboxProvider {
  return MailboxProviderStrategyFactory.getProvider(provider, customOptions);
}
