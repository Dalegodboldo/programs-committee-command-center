'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { visibleLinks } from '@/lib/nav';
import { arrangeLinks } from '@/lib/settings';
import { useSettings } from '@/components/SettingsContext';
import { useProfile } from './RoleContext';
import { sectionStyle } from '@/lib/colors';

const sectionIconName = (href: string) => sectionStyle(href).icon;
import Icon from './Icon';
import { Avatar, SectionIcon } from './ui';
import { today } from '@/lib/dates';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', member: 'Committee member', viewer: 'Viewer' };

export default function Nav() {
  const path = usePathname();
  const profile = useProfile();
  const [pending, setPending] = useState(0);
  const [late, setLate] = useState(0);
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
  // Late action items, shown as a red badge on the menu
  useEffect(() => {
    supabaseBrowser()
      .from('action_items')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'done')
      .lt('due_date', today())
      .then(({ count }: { count: number | null }) => setLate(count ?? 0));
  }, [path]);

  const { settings } = useSettings();
  const links = arrangeLinks(visibleLinks(profile.role), settings);
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const badge = (href: string, active = false) =>
    href === '/team' && pending > 0 ? (
      <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950" title="Waiting for approval">{pending} new</span>
    ) : href === '/actions' && late > 0 ? (
      <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-red-100 text-red-800' : 'bg-red-100 text-red-800'}`} title="Late action items">{late} late</span>
    ) : null;
  const account = (
    <>
      <div className="flex items-center gap-2.5">
        <Avatar name={profile.full_name ?? profile.email} size="h-8 w-8 text-[11px]" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.full_name ?? profile.email}</p>
          <p className="text-xs text-slate-500">{ROLE_LABEL[profile.role ?? ''] ?? ''}</p>
        </div>
      </div>
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
            <span className="block text-sm font-semibold">{settings.appName}</span>
            <span className="block text-[11px] text-slate-500">{current?.label ?? settings.appSubtitle}</span>
          </span>
        </Link>
        <button className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-800" onClick={() => setOpen(true)} aria-label="Open menu">
          <Icon name="menu" />
          {(pending > 0 || late > 0) && <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ${late > 0 ? 'bg-red-500' : 'bg-amber-500'}`} />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white print:hidden md:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="font-bold">Menu</span>
            <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="x" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-base ${isActive(l.href) ? 'bg-brand-700 font-semibold text-white' : 'text-slate-700 active:bg-slate-100'}`}>
                {isActive(l.href)
                  ? <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-gold-400"><Icon name={sectionIconName(l.href)} className="h-5 w-5" /></span>
                  : <SectionIcon href={l.href} size="h-9 w-9" iconSize="h-5 w-5" />}
                <span className="min-w-0 flex-1">
                  <span className="block">{l.label}</span>
                  <span className={`block truncate text-xs font-normal ${isActive(l.href) ? 'text-brand-100' : 'text-slate-500'}`}>{l.hint}</span>
                </span>
                {badge(l.href, isActive(l.href))}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-200 p-4">{account}</div>
        </div>
      )}

      {/* Computers and tablets: sidebar */}
      <aside className="hidden shrink-0 border-r border-slate-200 bg-white print:hidden md:flex md:min-h-screen md:w-64 md:flex-col">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <img src="/aitcf-seal.png" alt="" className="h-11 w-11" />
          <div className="min-w-0">
            <p className="font-bold leading-tight">{settings.appName}</p>
            {settings.appSubtitle && <p className="truncate text-xs text-slate-500">{settings.appSubtitle}</p>}
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-sm ${isActive(l.href) ? 'bg-brand-700 font-semibold text-white' : 'font-medium text-slate-700 hover:bg-slate-100'}`}>
              {isActive(l.href)
                ? <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-gold-400"><Icon name={sectionIconName(l.href)} className="h-[18px] w-[18px]" /></span>
                : <SectionIcon href={l.href} />}
              <span className="truncate">{l.label}</span>
              {badge(l.href, isActive(l.href))}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-200 p-4 text-sm">{account}</div>
        <p className="px-4 pb-4 text-[11px] leading-snug text-slate-400">
          Always In The Club Foundation
        </p>
      </aside>
    </>
  );
}
