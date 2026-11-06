import { describe, it, expect } from 'vitest';
import { GoogleProvider } from '@/core/providers/google-provider';
import { MicrosoftProvider } from '@/core/providers/microsoft-provider';
import { getMailboxProvider } from '@/core/providers/provider-factory';
import { MailboxProvider } from '@prisma/client';

describe('Mailbox Providers (Strategy Pattern)', () => {
  describe('GoogleProvider', () => {
    it('returns structured success result when failure rate is 0', async () => {
      const provider = new GoogleProvider({ failureRate: 0, delayMs: 0 });
      const result = await provider.provisionMailbox('test@google-domain.com');

      expect(result.email).toBe('test@google-domain.com');
      expect(result.success).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(result.providerMailboxId).toBeDefined();
      expect(result.errorMessage).toBeUndefined();
    });

    it('returns structured failure result when failure rate is 1', async () => {
      const provider = new GoogleProvider({ failureRate: 1, delayMs: 0 });
      const result = await provider.provisionMailbox('failed@google-domain.com');

      expect(result.email).toBe('failed@google-domain.com');
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('Google Workspace API:');
      expect(result.providerMailboxId).toBeUndefined();
    });
  });

  describe('MicrosoftProvider', () => {
    it('returns structured success result when failure rate is 0', async () => {
      const provider = new MicrosoftProvider({ failureRate: 0, delayMs: 0 });
      const result = await provider.provisionMailbox('test@ms-domain.com');

      expect(result.email).toBe('test@ms-domain.com');
      expect(result.success).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(result.providerMailboxId).toBeDefined();
    });

    it('returns structured failure result when failure rate is 1', async () => {
      const provider = new MicrosoftProvider({ failureRate: 1, delayMs: 0 });
      const result = await provider.provisionMailbox('failed@ms-domain.com');

      expect(result.email).toBe('failed@ms-domain.com');
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('Microsoft Graph API:');
    });
  });

  describe('Provider Factory Strategy Resolver', () => {
    it('resolves correct provider strategy instance for GOOGLE', () => {
      const provider = getMailboxProvider(MailboxProvider.GOOGLE);
      expect(provider.providerName).toBe(MailboxProvider.GOOGLE);
      expect(provider).toBeInstanceOf(GoogleProvider);
    });

    it('resolves correct provider strategy instance for MICROSOFT', () => {
      const provider = getMailboxProvider(MailboxProvider.MICROSOFT);
      expect(provider.providerName).toBe(MailboxProvider.MICROSOFT);
      expect(provider).toBeInstanceOf(MicrosoftProvider);
    });
  });
});
