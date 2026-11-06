import React from 'react';
import { OrderStatus, MailboxStatus } from '@prisma/client';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: OrderStatus | MailboxStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200',
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ACTIVE
        </span>
      );

    case 'PROVISIONING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse',
            className
          )}
        >
          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          PROVISIONING
        </span>
      );

    case 'PENDING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200',
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          PENDING
        </span>
      );

    case 'FAILED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200',
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          FAILED
        </span>
      );

    default:
      return (
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800',
            className
          )}
        >
          {status}
        </span>
      );
  }
}

