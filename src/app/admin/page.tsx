'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProviderBadge } from '@/components/ui/ProviderBadge';
import { OrderWithDetails, PaginatedResult } from '@/server/repositories/order.repository';
import {
  RefreshCw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowRight,
  Loader2,
  AlertCircle,
  Shield,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [ordersData, setOrdersData] = useState<PaginatedResult<OrderWithDetails> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & pagination state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

  const fetchAdminOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', '10');
      if (statusFilter) params.set('status', statusFilter);
      if (providerFilter) params.set('provider', providerFilter);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setOrdersData(json.data);
      } else {
        setError(json.error?.message || 'Failed to fetch admin orders');
      }
    } catch {
      setError('Network error fetching orders');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, providerFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        router.push('/customer');
      } else {
        fetchAdminOrders();
      }
    }
  }, [user, authLoading, router, fetchAdminOrders]);

  const handleRetryOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setRetryingOrderId(orderId);
      setError(null);

      const res = await fetch(`/api/admin/orders/${orderId}/retry`, {
        method: 'POST',
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Retry failed');
      }

      // Refresh list
      await fetchAdminOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry order');
    } finally {
      setRetryingOrderId(null);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const orders = ordersData?.data || [];
  const pagination = ordersData?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-purple-100 text-purple-700">
                <Shield className="w-4 h-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Admin Orders Console
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Global order overview, state machine monitoring, and failure recovery
            </p>
          </div>

          <button
            onClick={fetchAdminOrders}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROVISIONING">Provisioning</option>
              <option value="ACTIVE">Active</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Providers</option>
              <option value="GOOGLE">Google Workspace</option>
              <option value="MICROSOFT">Microsoft 365</option>
            </select>

            {(statusFilter || providerFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setProviderFilter('');
                  setCurrentPage(1);
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-900">{orders.length}</span> of{' '}
            <span className="font-semibold text-slate-900">{pagination.total}</span> orders
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin mb-2" />
              <p className="text-sm">Loading admin orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center px-4">
              <Layers className="w-10 h-10 text-slate-400 mb-2" />
              <h3 className="text-sm font-semibold text-slate-900">No matching orders found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Try adjusting your filter criteria or clear filters to view all orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3">Domain</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Provider</th>
                    <th className="px-6 py-3">Mailboxes</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const isRetrying = retryingOrderId === order.id;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => router.push(`/orders/${order.id}`)}
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          <div>{order.domain}</div>
                          <div className="text-[11px] font-mono text-slate-400 truncate max-w-[120px]">
                            {order.id}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-semibold text-slate-900">
                            {order.customer.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{order.customer.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <ProviderBadge provider={order.provider} />
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {order.mailboxCount} units
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Retry button for FAILED orders only */}
                            {order.status === 'FAILED' ? (
                              <button
                                onClick={(e) => handleRetryOrder(order.id, e)}
                                disabled={isRetrying}
                                title="Retry failed order (FAILED -> PENDING)"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md shadow-sm transition-colors disabled:opacity-50"
                              >
                                {isRetrying ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCw className="w-3 h-3" />
                                )}
                                <span>Retry</span>
                              </button>
                            ) : null}

                            <Link
                              href={`/orders/${order.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors px-2 py-1"
                            >
                              <span>Details</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="text-xs text-slate-500">
                Page <span className="font-semibold text-slate-900">{pagination.page}</span> of{' '}
                <span className="font-semibold text-slate-900">{pagination.totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage >= pagination.totalPages || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

