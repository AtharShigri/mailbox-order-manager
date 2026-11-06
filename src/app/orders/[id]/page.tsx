'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProviderBadge } from '@/components/ui/ProviderBadge';
import { OrderWithDetails } from '@/server/repositories/order.repository';
import {
  ArrowLeft,
  RefreshCw,
  RotateCw,
  Loader2,
  AlertCircle,
  Clock,
  History,
  Mail,
  ShieldCheck,
  Calendar,
  User,
} from 'lucide-react';
import Link from 'next/link';

export default function OrderDetailsPage() {
  const { id } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/orders/${id}`);
      const json = await res.json();

      if (json.success && json.data?.order) {
        setOrder(json.data.order);
      } else {
        setError(json.error?.message || 'Failed to load order details');
      }
    } catch {
      setError('Network error fetching order details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchOrderDetails();
      }
    }
  }, [user, authLoading, router, fetchOrderDetails]);

  const handleAdminRetry = async () => {
    if (!order) return;
    try {
      setRetrying(true);
      setError(null);

      const res = await fetch(`/api/admin/orders/${order.id}/retry`, {
        method: 'POST',
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Admin retry failed');
      }

      await fetchOrderDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const backLink = user?.role === 'ADMIN' ? '/admin' : '/customer';

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href={backLink}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {user?.role === 'ADMIN' ? 'Admin Orders' : 'My Orders'}</span>
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-sm font-medium">Loading order details...</p>
          </div>
        ) : !order ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
            <p className="text-sm text-slate-500">Order not found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Header Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {order.domain}
                  </h1>
                  <StatusBadge status={order.status} />
                  <ProviderBadge provider={order.provider} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                  <span>Order ID: {order.id}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    Idempotency Key: {order.idempotencyKey}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto">
                <button
                  onClick={fetchOrderDetails}
                  disabled={loading}
                  title="Refresh order details"
                  className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {/* Admin Retry Button */}
                {user?.role === 'ADMIN' && order.status === 'FAILED' && (
                  <button
                    onClick={handleAdminRetry}
                    disabled={retrying}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {retrying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCw className="w-3.5 h-3.5" />
                    )}
                    <span>Admin Retry Order</span>
                  </button>
                )}
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Mailboxes</span>
                </div>
                <div className="text-xl font-bold text-slate-900">{order.mailboxCount}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Pre-warmed accounts</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer</span>
                </div>
                <div className="text-sm font-bold text-slate-900 truncate">
                  {order.customer.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{order.customer.email}</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Created At</span>
                </div>
                <div className="text-xs font-semibold text-slate-900">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Initial submission timestamp</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last Updated</span>
                </div>
                <div className="text-xs font-semibold text-slate-900">
                  {new Date(order.updatedAt).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">State machine transition</div>
              </div>
            </div>

            {/* Individual Mailboxes Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-600" />
                  <h2 className="text-sm font-bold text-slate-900">Individual Mailbox Statuses</h2>
                </div>
                <span className="text-xs text-slate-500">
                  {order.mailboxes.filter((m) => m.status === 'ACTIVE').length} of{' '}
                  {order.mailboxes.length} Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-6 py-3">Mailbox Email</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Provisioning Details / Error</th>
                      <th className="px-6 py-3 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.mailboxes.map((mb, idx) => (
                      <tr key={mb.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-mono">#{idx + 1}</span>
                            <span>{mb.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={mb.status} />
                        </td>
                        <td className="px-6 py-3.5 text-xs">
                          {mb.errorMessage ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 max-w-md">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{mb.errorMessage}</span>
                            </div>
                          ) : mb.status === 'ACTIVE' ? (
                            <span className="text-emerald-700 font-medium">
                              Provisioned successfully
                            </span>
                          ) : (
                            <span className="text-slate-400">Awaiting provisioning worker</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-500 text-right">
                          {new Date(mb.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <h2 className="text-sm font-bold text-slate-900">Complete Audit Trail</h2>
                </div>
                <span className="text-xs text-slate-500">{order.auditLogs.length} events logged</span>
              </div>

              <div className="p-6">
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {order.auditLogs.map((log) => (
                    <div key={log.id} className="relative group">
                      {/* Node Dot */}
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-600 shadow-sm" />

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            {log.previousStatus && (
                              <>
                                <StatusBadge status={log.previousStatus} />
                                <span className="text-slate-400 font-bold">→</span>
                              </>
                            )}
                            <StatusBadge status={log.newStatus} />
                            {log.actorId && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200/70 font-mono text-slate-600 font-semibold">
                                Actor: {log.actorId}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 font-medium">{log.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

