'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Mail, LogOut, Shield, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const { user, logout, login } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleQuickSwitch = async (email: string) => {
    try {
      const switchedUser = await login(email, 'Password123!');
      if (switchedUser.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/customer');
      }
    } catch (err) {
      console.error('Quick switch failed:', err);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            href={user.role === 'ADMIN' ? '/admin' : '/customer'}
            className="flex items-center gap-2.5 text-slate-900 font-bold text-lg hover:opacity-90 transition-opacity"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <span>Mailbox Manager</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {user.role === 'CUSTOMER' && (
              <Link
                href="/customer"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                My Orders
              </Link>
            )}

            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Admin Orders
                </Link>
                <Link
                  href="/customer"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Customer View
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User context & actions */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Switcher */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 mr-2 border-r border-slate-200 pr-3">
            <span className="font-medium text-slate-400">Switch:</span>
            <button
              onClick={() => handleQuickSwitch('admin@example.com')}
              className={`px-2 py-1 rounded transition-colors ${
                user.email === 'admin@example.com'
                  ? 'bg-purple-100 text-purple-800 font-semibold'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => handleQuickSwitch('customer1@example.com')}
              className={`px-2 py-1 rounded transition-colors ${
                user.email === 'customer1@example.com'
                  ? 'bg-blue-100 text-blue-800 font-semibold'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Cust 1
            </button>
            <button
              onClick={() => handleQuickSwitch('customer2@example.com')}
              className={`px-2 py-1 rounded transition-colors ${
                user.email === 'customer2@example.com'
                  ? 'bg-blue-100 text-blue-800 font-semibold'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Cust 2
            </button>
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
              {user.role === 'ADMIN' ? (
                <Shield className="w-4 h-4 text-purple-600" />
              ) : (
                <User className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-tight">
                {user.name}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <span>{user.email}</span>
                <span
                  className={`px-1 rounded text-[10px] font-bold ${
                    user.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

