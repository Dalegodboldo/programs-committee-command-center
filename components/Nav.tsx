'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { visibleLinks } from '@/lib/nav';
import { useProfile } from './RoleContext';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', member: 'Committee member', viewer: 'Viewer' };

export default function Nav() {
  const path = usePathname();
  const profile = useProfile();
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (profile.role !== 'admin') return;
    supabaseBrowser()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .is('role', null)
      .eq('declined', false)
      .then(({ count }: { count: number | null }) => setPending(count ?? 0));
  }, [profile.role, path]);
  useEffect(() => setOpen(false), [path]);

  const links = visibleLinks(profile.role);
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const badge = (href: string) => href === '/team' && pending > 0 && (
    <span className="ml-2 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{pending}</span>
  );
  const account = (
    <>
      <p className="font-medium">{profile.full_name ?? profile.email}</p>
      <p className="text-xs text-slate-500">{ROLE_LABEL[profile.role ?? ''] ?? ''}</p>
      <div className="mt-2 flex gap-4 text-sm">
        <Link href="/set-password" className="text-brand-600 hover:underline">Change password</Link>
        <form action="/auth/signout" method="post">
          <button className="text-brand-600 hover:underline">Sign out</button>
        </form>
      </div>
    </>
  );
  const current = links.find((l) => isActive(l.href));

  return (
    <>
      {/* Phones: top bar with a menu button */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur print:hidden md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <img src="/aitcf-seal.png" alt="" className="h-8 w-8" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Programs Committee</span>
            <span className="block text-[11px] text-slate-500">{current?.label ?? 'Command Center'}</span>
          </span>
        </Link>
        <button className="relative rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium" onClick={() => setOpen(true)} aria-label="Open menu">
          ☰ Menu
          {pending > 0 && <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-amber-500" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white print:hidden md:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="font-semibold">Menu</span>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setOpen(false)} aria-label="Close menu">✕ Close</button>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base ${isActive(l.href) ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 active:bg-slate-100'}`}>
                <span className="text-xl">{l.icon}</span>
                <span className="flex-1">{l.label}{badge(l.href)}</span>
                <span className="text-xs text-slate-400">{l.hint}</span>
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-200 p-4">{account}</div>
        </div>
      )}

      {/* Computers and tablets: sidebar */}
      <aside className="hidden shrink-0 border-r border-slate-200 bg-white print:hidden md:block md:min-h-screen md:w-60">
        <div className="p-4">
          <img src="/aitcf-seal.png" alt="" className="mb-2 h-10 w-10" />
          <p className="font-semibold leading-tight">Programs Committee</p>
          <p className="text-xs text-slate-500">Command Center</p>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive(l.href) ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>
              {l.label}{badge(l.href)}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-slate-200 p-4 text-sm">{account}</div>
        <p className="px-4 pb-4 text-[11px] leading-snug text-slate-400">
          Always In The Club Foundation
        </p>
      </aside>
    </>
  );
}
