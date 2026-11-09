'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, LayoutGrid, LogOut, Network, ReceiptText, Scale, ScrollText, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy, roleLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';
import { cn } from '@/lib/utils';

export function useSessionReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (useAuth.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useAuth.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useSessionReady();
  const user = useAuth((state) => state.user);
  const clear = useAuth((state) => state.clear);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) {
      router.replace('/login');
    }
  }, [ready, user, router]);

  const balance = useQuery({
    queryKey: ['balance'],
    queryFn: () => api.balance(),
    enabled: ready && Boolean(user),
  });
  const inbox = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications(),
    enabled: ready && Boolean(user),
    refetchInterval: 15_000,
  });

  if (!ready || !user) {
    return <p className="px-5 py-16 text-center text-sm text-ink/60">{copy.states.loading}</p>;
  }

  const partnerNav = user.role !== 'MEMBER';
  const links = [
    ...(user.role === 'SUPER_ADMIN'
      ? [
          { href: '/settlement', label: copy.nav.settlement, icon: Scale },
          { href: '/audit-logs', label: copy.nav.audit, icon: ScrollText },
        ]
      : []),
    ...(partnerNav ? [{ href: '/hierarchy', label: copy.nav.hierarchy, icon: Network }] : []),
    { href: '/catalog', label: copy.nav.catalog, icon: LayoutGrid },
    { href: '/orders', label: copy.nav.orders, icon: ReceiptText },
    { href: '/transactions', label: copy.nav.flow, icon: Wallet },
  ];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/80 bg-paper/90 px-4 py-3 text-white backdrop-blur">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">{copy.brand}</p>
          <p className="text-sm font-semibold">{user.displayName}</p>
          <p className="text-xs text-ink/55">{roleLabel(user.role)}</p>
        </div>
        <div className="text-right">
          <Link href="/notifications" className="mb-1 inline-flex items-center gap-1 text-white" aria-label={copy.nav.notifications}>
            <Bell className="h-4 w-4" />
            <span className="min-w-5 rounded-full bg-[#dc2626] px-1.5 text-center text-[10px] font-semibold leading-4 text-white">
              {inbox.isSuccess ? inbox.data.unread : '…'}
            </span>
          </Link>
          <p className="text-[11px] text-ink/55">{copy.nav.balance}</p>
          <p className="font-mono text-sm font-medium">
            {balance.isSuccess ? formatPoints(balance.data.available) : balance.isError ? '—' : '…'}
          </p>
          <button
            className="mt-1 inline-flex items-center gap-1 text-xs text-ink/60"
            onClick={() => {
              clear();
              router.replace('/login');
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            {copy.nav.logout}
          </button>
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[#0a0a0a]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium',
                  active ? 'text-[#dc2626]' : 'text-white/50',
                )}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
