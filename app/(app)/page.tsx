'use client';

import Link from 'next/link';
import { useLiveTable } from '@/lib/useLiveTable';
import { useCan, useProfile } from '@/components/RoleContext';
import { visibleLinks } from '@/lib/nav';
import { arrangeLinks } from '@/lib/settings';
import { useSettings } from '@/components/SettingsContext';
import Icon from '@/components/Icon';
import { Avatar, Chip, DueChip, SectionIcon, WorkstreamChip } from '@/components/ui';
import { firstName, sectionStyle, workstreamTone } from '@/lib/colors';
import { addDays, daysUntil, longDate, today } from '@/lib/dates';
import type { Row } from '@/lib/types';
import { goalMet } from '@/lib/goals';

export default function Overview() {
  const profile = useProfile();
  const { canEdit } = useCan();
  const { settings } = useSettings();
  const actions = useLiveTable('action_items', { orderBy: 'due_date' });
  const meetings = useLiveTable('meetings', { orderBy: 'meeting_date' });
  const goals = useLiveTable('goals', { orderBy: 'sort_order' });
  const questions = useLiveTable('open_questions', { orderBy: 'sort_order' });
  const partners = useLiveTable('partners', { orderBy: 'next_step_date' });
  const grants = useLiveTable('grants', { orderBy: 'deadline' });
  const activity = useLiveTable('activity_log', { orderBy: 'created_at', ascending: false, limit: 12 });

  const t = today();
  const weekOut = addDays(t, 7);
  const open = actions.rows.filter((a) => a.status !== 'done');
  const overdue = open.filter((a) => a.due_date && a.due_date < t);
  const dueSoon = open.filter((a) => a.due_date && a.due_date >= t && a.due_date <= weekOut);

  const first = (profile.full_name ?? '').split(' ')[0];
  const isMine = (a: Row) => !!profile.full_name && (a.owner === profile.full_name || a.owner === 'All members' || (!!first && a.owner?.startsWith(first + ' ')));
  const mine = open.filter(isMine).sort(byDue);
  const myLate = mine.filter((a) => a.due_date && a.due_date < t).length;
  const myToday = mine.filter((a) => a.due_date === t).length;

  const nextMeeting = meetings.rows
    .filter((m) => m.status === 'planned' && (!m.meeting_date || m.meeting_date >= t))
    .sort((a, b) => ((a.meeting_date ?? '9999') < (b.meeting_date ?? '9999') ? -1 : 1))[0];
  const meetingIn = nextMeeting?.meeting_date ? daysUntil(nextMeeting.meeting_date) : null;
  const scorecard = goals.rows.filter((g) => g.category === 'scorecard');
  const scoreDone = scorecard.filter(goalMet).length;
  const openQs = questions.rows.filter((q) => q.status === 'open');

  // Everything dated from today through the next two weeks, grouped by day.
  const horizon = addDays(t, 14);
  type Up = { id: string; date: string; what: string; who: string; kind: 'Action' | 'Partner' | 'Grant' | 'Meeting'; href: string };
  const upcoming: Up[] = [
    ...open.filter((a) => a.due_date && a.due_date >= t && a.due_date <= horizon)
      .map((a) => ({ id: 'a' + a.id, date: a.due_date, what: a.title, who: firstName(a.owner), kind: 'Action' as const, href: '/actions' })),
    ...partners.rows.filter((p) => p.next_step_date && p.next_step_date >= t && p.next_step_date <= horizon && !['declined', 'paused'].includes(p.status))
      .map((p) => ({ id: 'p' + p.id, date: p.next_step_date, what: `${p.name}: ${p.next_step || 'next step'}`, who: firstName(p.owner), kind: 'Partner' as const, href: '/partners' })),
    ...grants.rows.filter((g) => g.deadline && g.deadline >= t && g.deadline <= horizon && ['researching', 'writing'].includes(g.status))
      .map((g) => ({ id: 'g' + g.id, date: g.deadline, what: `${g.funder} deadline`, who: firstName(g.owner), kind: 'Grant' as const, href: '/partners' })),
    ...meetings.rows.filter((m) => m.status === 'planned' && m.meeting_date && m.meeting_date >= t && m.meeting_date <= horizon)
      .map((m) => ({ id: 'm' + m.id, date: m.meeting_date, what: m.title, who: 'Committee', kind: 'Meeting' as const, href: '/meetings' })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'Meeting' ? -1 : 1));
  const days = Array.from(new Set(upcoming.map((u) => u.date))).slice(0, 5).map((date) => ({ date, items: upcoming.filter((u) => u.date === date) }));

  const streams = Object.entries(
    actions.rows.reduce<Record<string, { done: number; total: number }>>((acc, a) => {
      const k = a.workstream || 'Other';
      acc[k] = acc[k] ?? { done: 0, total: 0 };
      acc[k].total++;
      if (a.status === 'done') acc[k].done++;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].total - a[1].total);

  const recent = [...activity.rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 8);
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const summary: React.ReactNode[] = [];
  if (myLate) summary.push(<b key="l" className="text-red-700">{myLate} late {myLate === 1 ? 'item' : 'items'}</b>);
  if (myToday) summary.push(<b key="t" className="text-amber-800">{myToday} due today</b>);

  const blocks: Record<string, React.ReactNode> = {
    meeting: (
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-brand-700 p-6 text-white shadow-sm">
          <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-[6px] border-gold-400">
            {meetingIn != null ? (
              <>
                <span className="text-3xl font-extrabold leading-none">{meetingIn === 0 ? 'Today' : meetingIn}</span>
                {meetingIn !== 0 && <span className="text-xs font-semibold text-gold-100">{meetingIn === 1 ? 'day' : 'days'}</span>}
              </>
            ) : (
              <Icon name="calendar" className="h-8 w-8 text-gold-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-400">Next meeting</p>
            {nextMeeting ? (
              <>
                <p className="mt-1 text-2xl font-bold">{nextMeeting.meeting_date ? longDate(nextMeeting.meeting_date).replace(/, \d{4}$/, '') : 'Date to set'}</p>
                <p className="text-sm text-brand-100">{nextMeeting.title}</p>
              </>
            ) : (
              <p className="mt-1 text-lg">No meeting scheduled yet.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
              <Link href="/meetings" className="rounded-xl bg-white/10 px-3.5 py-2 hover:bg-white/20">Meetings</Link>
              <Link href="/meetings?tab=questions" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 hover:bg-white/20">
                <span className="h-2 w-2 rounded-full bg-violet-300" />{openQs.length} open {openQs.length === 1 ? 'question' : 'questions'}
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold">December scorecard</h2>
            <Link href="/plan"><Chip cls="bg-teal-100 text-teal-800">{scoreDone} of {scorecard.length} met</Chip></Link>
          </div>
          <ul className="space-y-2.5 text-sm">
            {scorecard.map((g) => {
              const met = goalMet(g);
              const target = g.target_value != null ? Number(g.target_value) : null;
              const current = Number(g.current_value ?? 0);
              const pct = met ? 100 : target ? Math.min(100, Math.round((current / target) * 100)) : 0;
              return (
                <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_80px_52px] items-center gap-3">
                  <span className={`truncate ${met ? 'text-slate-400 line-through' : ''}`} title={g.title}>{g.title}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${met ? 'bg-green-500' : 'bg-teal-500'}`} style={{ width: `${pct}%` }} /></span>
                  <span className={`text-right text-xs font-semibold ${met ? 'text-green-700' : 'text-slate-500'}`}>{met ? 'Met' : target != null ? `${current} / ${target}` : 'Not yet'}</span>
                </li>
              );
            })}
            {scorecard.length === 0 && <li className="text-slate-400">No scorecard yet.</li>}
          </ul>
        </div>
      </section>
    ),

    stats: (
      <>
        <section className="grid grid-cols-3 gap-2 md:hidden">
          <MiniStat href="/actions?view=overdue" value={overdue.length} label="Overdue" cls="border-red-200 bg-red-50 text-red-800" />
          <MiniStat href="/actions?view=week" value={dueSoon.length} label="This week" cls="border-amber-200 bg-amber-50 text-amber-900" />
          <MiniStat href="/meetings?tab=questions" value={openQs.length} label="Questions" cls="border-violet-200 bg-violet-50 text-violet-800" />
        </section>
        <section className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
          <Stat href="/actions" icon="list" iconCls="bg-blue-100 text-blue-700" value={open.length} label="Open action items" />
          <Stat href="/actions?view=overdue" icon="alert" iconCls="bg-red-100 text-red-700" value={overdue.length} label="Overdue"
            warn={overdue.length > 0} />
          <Stat href="/actions?view=week" icon="clock" iconCls="bg-amber-100 text-amber-700" value={dueSoon.length} label="Due in the next 7 days" />
          <Stat href="/meetings?tab=questions" icon="question" iconCls="bg-violet-100 text-violet-700" value={openQs.length} label="Open questions" />
        </section>
      </>
    ),

    lists: (
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">My action items</h2>
            <Link href="/actions?view=mine" className="text-sm font-semibold text-blue-700 hover:underline">See all</Link>
          </div>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-500">{profile.full_name ? 'Nothing open with your name on it.' : 'Add your full name on the Team page to see your items here.'}</p>
          ) : (
            <ul className="space-y-2.5">
              {mine.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                  {canEdit ? (
                    <button
                      className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-slate-300 bg-white hover:border-green-600 hover:bg-green-50"
                      title="Mark done" aria-label={`Mark done: ${a.title}`}
                      onClick={() => actions.update(a.id, { status: 'done' })}
                    />
                  ) : <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-slate-300 bg-white" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <WorkstreamChip value={a.workstream} />
                      <DueChip due={a.due_date} status={a.status} today={t} />
                      {a.status === 'in_progress' && <Chip cls="bg-amber-100 text-amber-800">In progress</Chip>}
                      {a.status === 'blocked' && <Chip cls="bg-red-100 text-red-800">Blocked</Chip>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Coming up</h2>
            <span className="text-sm text-slate-500">Next two weeks</span>
          </div>
          {days.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing dated in the next two weeks.</p>
          ) : (
            <ul className="space-y-4">
              {days.map((d) => {
                const isToday = d.date === t;
                const hasMeeting = d.items.some((i) => i.kind === 'Meeting');
                const box = isToday ? 'bg-amber-300 text-amber-950' : hasMeeting ? 'bg-violet-100 text-violet-800' : 'bg-blue-50 text-blue-800';
                const dt = new Date(d.date + 'T12:00:00');
                return (
                  <li key={d.date} className="flex gap-3.5">
                    <div className={`w-[52px] shrink-0 rounded-xl py-1.5 text-center ${box}`}>
                      <div className="text-[11px] font-bold uppercase">{isToday ? 'Today' : dt.toLocaleDateString('en-US', { month: 'short' })}</div>
                      <div className="text-xl font-extrabold leading-tight">{dt.getDate()}</div>
                    </div>
                    <ul className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                      {d.items.slice(0, 4).map((i) => (
                        <li key={i.id} className="flex items-center gap-2 text-sm">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[i.kind]}`} title={i.kind} />
                          <Link href={i.href} className={`min-w-0 flex-1 truncate hover:underline ${i.kind === 'Meeting' ? 'font-semibold' : ''}`}>{i.what}</Link>
                          <span className="whitespace-nowrap text-xs text-slate-500">{i.who}</span>
                        </li>
                      ))}
                      {d.items.length > 4 && <li className="text-xs text-slate-500">and {d.items.length - 4} more</li>}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {(Object.keys(KIND_DOT) as (keyof typeof KIND_DOT)[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${KIND_DOT[k]}`} />{k === 'Action' ? 'Action item' : k}</span>
            ))}
          </div>
        </div>
      </section>
    ),

    progress: (
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold">Workstreams</h2>
          {streams.length === 0 ? (
            <p className="text-sm text-slate-500">No action items yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {streams.map(([name, s]) => {
                const tone = workstreamTone(name);
                return (
                  <Link key={name} href={`/actions?stream=${encodeURIComponent(name)}`} className={`block rounded-xl p-3 hover:brightness-[0.97] ${tone.tile}`}>
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="truncate text-sm font-bold">{name}</span>
                      <span className="text-xs font-semibold">{s.done}/{s.total}</span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/80">
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${s.total ? Math.round((s.done / s.total) * 100) : 0}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-bold">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">Changes will appear here as they happen.</p>
          ) : (
            <ul className="space-y-3.5">
              {recent.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <Avatar name={a.actor_name ?? 'System'} size="h-8 w-8 text-[11px]" />
                  <div className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-semibold">{a.actor_name ?? 'System'}</span> {verb(a.action)} {noun(a.table_name)}
                    {a.summary ? <span className="font-medium text-slate-700"> “{a.summary}”</span> : null}
                    <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    ),
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{todayLabel}</p>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{hello}{first ? `, ${first}` : ''}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {summary.length ? <>You have {summary.reduce<React.ReactNode[]>((acc, s, i) => (i ? [...acc, ' and ', s] : [s]), [])}. </> : mine.length ? 'Nothing late on your list. ' : ''}
            {meetingIn != null && nextMeeting ? (meetingIn === 0 ? `${nextMeeting.title} is today.` : `${nextMeeting.title} is in ${meetingIn} ${meetingIn === 1 ? 'day' : 'days'}.`) : ''}
          </p>
          {settings.welcome && <p className="mt-0.5 text-xs text-slate-500">{settings.welcome}</p>}
        </div>
        <button
          className="hidden min-h-[44px] items-center gap-2 rounded-xl bg-gold-400 px-4 text-sm font-bold text-brand-900 hover:brightness-95 md:inline-flex"
          onClick={() => window.dispatchEvent(new Event('open-ask-claude'))}
        >
          <Icon name="sparkle" className="h-[18px] w-[18px]" />Ask Claude
        </button>
      </header>

      {settings.announcement && (
        <div className="whitespace-pre-line rounded-2xl border border-gold-400 bg-gold-50 px-4 py-3 text-sm font-medium text-gold-800">{settings.announcement}</div>
      )}

      {settings.overviewOrder.filter((k) => !settings.overviewHidden.includes(k)).map((k) => (
        <div key={k}>{blocks[k]}</div>
      ))}

      {/* Phones: every section one tap away */}
      <nav className="grid grid-cols-2 gap-2.5 md:hidden" aria-label="Sections">
        {arrangeLinks(visibleLinks(profile.role), settings).filter((l) => l.href !== '/').map((l) => (
          <Link key={l.href} href={l.href} className={`flex min-h-[84px] flex-col justify-between gap-2 rounded-2xl p-3.5 active:brightness-95 ${sectionStyle(l.href).soft}`}>
            <SectionIcon href={l.href} size="h-9 w-9" iconSize="h-5 w-5" className="bg-white/70" />
            <span className="text-sm font-bold leading-tight">{l.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

const KIND_DOT = { Action: 'bg-blue-500', Partner: 'bg-orange-500', Grant: 'bg-teal-500', Meeting: 'bg-violet-500' } as const;

function byDue(a: Row, b: Row) {
  return (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1;
}

function Stat({ href, icon, iconCls, value, label, warn }: { href: string; icon: string; iconCls: string; value: number; label: string; warn?: boolean }) {
  return (
    <Link href={href} className={`card flex items-center gap-3.5 !p-4 hover:shadow-md ${warn ? '!border-red-200 !bg-red-50' : ''}`}>
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconCls}`}><Icon name={icon} /></span>
      <span>
        <span className={`block text-[28px] font-extrabold leading-tight ${warn ? 'text-red-800' : ''}`}>{value}</span>
        <span className={`text-sm font-medium ${warn ? 'text-red-800' : 'text-slate-500'}`}>{label}</span>
      </span>
    </Link>
  );
}

function MiniStat({ href, value, label, cls }: { href: string; value: number; label: string; cls: string }) {
  return (
    <Link href={href} className={`rounded-2xl border px-3 py-2.5 ${cls}`}>
      <span className="block text-2xl font-extrabold leading-tight">{value}</span>
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}

const verb = (a: string) => ({ insert: 'added', update: 'updated', delete: 'removed' } as Record<string, string>)[a] ?? a;
const noun = (t: string) =>
  ({
    meetings: 'a meeting', action_items: 'an action item', decisions: 'a decision', open_questions: 'an open question', goals: 'a goal',
    spotlight_artists: 'a Spotlight artist', content_posts: 'a Spotlight post', mentors: 'a mentor', mentees: 'a mentee',
    mentoring_sessions: 'a mentoring session', partners: 'a partner', grants: 'a grant', provider_classes: 'a Florida class', documents: 'a document',
    doc_subfolders: 'a folder', app_settings: 'the app design', weekly_email: 'the weekly email',
  } as Record<string, string>)[t] ?? t;
