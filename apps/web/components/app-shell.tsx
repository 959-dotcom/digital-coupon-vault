'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, CircleUser, House, LogOut, ScrollText, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { copy, roleLabel } from '@/lib/copy';
import { formatPoints } from '@/lib/money';
import { cn } from '@/lib/utils';

export function ReferralLink({ path }: { path: string | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!path) {
    return null;
  }
  const link = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="text-[11px] text-white/50">{copy.referral.title}</p>
        <p className="truncate font-mono text-xs">{link}</p>
      </div>
      <button
        type="button"
        className="inline-flex min-h-11 shrink-0 items-center px-3 text-sm text-brass"
        onClick={() => {
          void navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? copy.referral.copied : copy.referral.copy}
      </button>
    </div>
  );
}

export function tabActive(pathname: string, href: string): boolean {
  if (href === '/money') {
    return ['/money', '/deposit', '/withdraw'].includes(pathname);
  }
  if (href === '/reports') {
    return ['/reports', '/network', '/history', '/bills', '/hierarchy', '/hold'].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }
  if (href === '/account') {
    return ['/account', '/staff', '/products', '/catalog', '/orders', '/settlement', '/withdrawals', '/audit-logs', '/notifications'].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  return pathname === href;
}

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
    queryKey: ['cash'],
    queryFn: () => api.cash(),
    enabled: ready && Boolean(user),
  });
  const inbox = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications(),
    enabled: ready && Boolean(user),
    refetchInterval: 15_000,
  });
  const referral = useQuery({
    queryKey: ['referral'],
    queryFn: () => api.referral(),
    enabled: ready && Boolean(user),
  });

  if (!ready || !user) {
    return <p className="px-5 py-16 text-center text-sm text-ink/60">{copy.states.loading}</p>;
  }
  const links = [
    { href: '/home', label: copy.nav.home, icon: House },
    { href: '/money', label: copy.nav.money, icon: Wallet },
    { href: '/reports', label: copy.nav.reports, icon: ScrollText },
    { href: '/account', label: copy.nav.account, icon: CircleUser },
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
      <main className="space-y-4 px-4 py-4">
        {pathname === '/home' ? <ReferralLink path={referral.data?.path} /> : null}
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[#0a0a0a]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {links.map((link) => {
            const Icon = link.icon;
            const active = tabActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium',
                  active ? 'text-[#dc2626]' : 'text-white/70',
                )}
              >
                <Icon className="h-6 w-6" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
