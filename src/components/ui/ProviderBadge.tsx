import React from 'react';
import { MailboxProvider } from '@prisma/client';
import { cn } from '@/lib/utils';

interface ProviderBadgeProps {
  provider: MailboxProvider | string;
  className?: string;
}

export function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  if (provider === 'GOOGLE') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200',
          className
        )}
      >
        <span className="font-bold">G</span> Google Workspace
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200',
        className
      )}
    >
      <span className="font-bold">M</span> Microsoft 365
    </span>
  );
}

