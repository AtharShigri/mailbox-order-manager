'use client';

import React, { useState, useEffect } from 'react';
import { MailboxProvider } from '@prisma/client';
import { X, Loader2, AlertCircle, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const [domain, setDomain] = useState('');
  const [provider, setProvider] = useState<MailboxProvider>(MailboxProvider.GOOGLE);
  const [mailboxCount, setMailboxCount] = useState<number>(5);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize or reset idempotency key when opening modal
  useEffect(() => {
    if (isOpen) {
      if (!idempotencyKey) {
        setIdempotencyKey(crypto.randomUUID());
      }
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, idempotencyKey]);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setDomain('');
    setProvider(MailboxProvider.GOOGLE);
    setMailboxCount(5);
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Client-side quick check
    const trimmedDomain = domain.trim().toLowerCase();
    if (!trimmedDomain || !trimmedDomain.includes('.')) {
      setError('Please provide a valid domain name (e.g. acme.com)');
      return;
    }

    if (mailboxCount < 1 || mailboxCount > 50) {
      setError('Mailbox count must be between 1 and 50');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          domain: trimmedDomain,
          provider,
          mailboxCount: Number(mailboxCount),
        }),
      });

      const json = await res.json();

      if (!json.success) {
        // If error occurred, DO NOT change idempotency key so user can retry same request
        throw new Error(json.error?.message || 'Failed to create order');
      }

      const replayNote = json.data?.idempotentReplay
        ? ' (Idempotent replay: existing order retrieved)'
        : '';
      setSuccessMessage(`Order created successfully for ${domain}!${replayNote}`);

      // Order created successfully: reset idempotency key for future orders
      setTimeout(() => {
        handleResetForm();
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      // NOTE: On failure, idempotencyKey is intentionally retained for safe re-submission
      setError(
        err instanceof Error
          ? err.message
          : 'Network error occurred. You can retry safely with the same idempotency key.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Create Mailbox Order</h3>
            <p className="text-xs text-slate-500">
              Provision pre-warmed Google or Microsoft mailboxes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Submission failed</div>
              <div>{error}</div>
              <div className="mt-1 text-[11px] text-rose-600">
                Idempotency key retained. Retrying will not double-charge or create duplicate orders.
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Domain */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Domain Name
            </label>
            <input
              type="text"
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. yourcompany.com"
              className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Mailboxes will be created under this registered domain.
            </p>
          </div>

          {/* Provider Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider(MailboxProvider.GOOGLE)}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  provider === MailboxProvider.GOOGLE
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  G
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Google</div>
                  <div className="text-[11px] text-slate-500">Workspace</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider(MailboxProvider.MICROSOFT)}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  provider === MailboxProvider.MICROSOFT
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                  M
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Microsoft</div>
                  <div className="text-[11px] text-slate-500">365 Exchange</div>
                </div>
              </button>
            </div>
          </div>

          {/* Mailbox Count */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Mailbox Count (1 to 50)
              </label>
              <span className="text-xs font-bold text-blue-600">{mailboxCount} mailboxes</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="50"
                value={mailboxCount}
                onChange={(e) => setMailboxCount(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <input
                type="number"
                min="1"
                max="50"
                value={mailboxCount}
                onChange={(e) => setMailboxCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="w-16 px-2 py-1 text-center text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Idempotency Key Badge */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="font-mono truncate">Key: {idempotencyKey}</span>
            </div>
            <button
              type="button"
              onClick={() => setIdempotencyKey(crypto.randomUUID())}
              title="Regenerate key"
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors ml-2"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Confirm & Create Order</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

