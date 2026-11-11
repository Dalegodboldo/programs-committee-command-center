'use client';

import Link from 'next/link';
import { useLiveTable } from '@/lib/useLiveTable';
import { useProfile } from '@/components/RoleContext';
import { visibleLinks } from '@/lib/nav';
import { Pill, Progress } from '@/components/Tabs';
import { addDays, daysUntil, longDate, relative, shortDate, today } from '@/lib/dates';
import type { Row } from '@/lib/types';
import { goalMet } from '@/lib/goals';

export default function Overview() {
  const profile = useProfile();
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
  const done = actions.rows.length - open.length;

  const firstName = (profile.full_name ?? '').split(' ')[0];
  const mine = open
    .filter((a) => a.owner && profile.full_name && (a.owner === profile.full_name || a.owner === 'All members' || (firstName && a.owner.startsWith(firstName + ' '))))
    .sort(byDue);

  const nextMeeting = meetings.rows.filter((m) => m.status === 'planned' && (!m.meeting_date || m.meeting_date >= t)).sort((a, b) => (a.meeting_date ?? '9999') < (b.meeting_date ?? '9999') ? -1 : 1)[0];
  const scorecard = goals.rows.filter((g) => g.category === 'scorecard');
  const scoreDone = scorecard.filter(goalMet).length;
  const openQs = questions.rows.filter((q) => q.status === 'open');

  // Everything with a date in the next two weeks, in one list.
  const horizon = addDays(t, 14);
  const comingUp = [
    ...open.filter((a) => a.due_date && a.due_date <= horizon).map((a) => ({ id: 'a' + a.id, date: a.due_date, what: a.title, who: a.owner, kind: 'Action', href: '/actions' })),
    ...partners.rows.filter((p) => p.next_step_date && p.next_step_date >= t && p.next_step_date <= horizon && !['declined', 'paused'].includes(p.status))
      .map((p) => ({ id: 'p' + p.id, date: p.next_step_date, what: `${p.name}: ${p.next_step || 'next step'}`, who: p.owner, kind: 'Partner', href: '/partners' })),
    ...grants.rows.filter((g) => g.deadline && g.deadline >= t && g.deadline <= horizon && ['researching', 'writing'].includes(g.status))
      .map((g) => ({ id: 'g' + g.id, date: g.deadline, what: `${g.funder} deadline`, who: g.owner, kind: 'Grant', href: '/partners' })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 10);

  const streams = Object.entries(
    actions.rows.reduce<Record<string, { done: number; total: number }>>((acc, a) => {
      const k = a.workstream || 'Other';
      acc[k] = acc[k] ?? { done: 0, total: 0 };
      acc[k].total++;
      if (a.status === 'done') acc[k].done++;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].total - a[1].total);

  const recent = [...activity.rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 10);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome{firstName ? `, ${firstName}` : ''}</h1>
          <p className="text-sm text-slate-500">Programs Committee Command Center. Everything here updates live.</p>
        </div>
      </header>

      {/* Phones: every section one tap away */}
      <nav className="grid grid-cols-2 gap-2 md:hidden" aria-label="Sections">
        {visibleLinks(profile.role).filter((l) => l.href !== '/').map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-center gap-2 p-3 active:bg-slate-50">
            <span className="text-2xl">{l.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{l.label}</span>
              <span className="block truncate text-[11px] text-slate-500">{l.hint}</span>
            </span>
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-3 rounded-xl bg-brand-700 p-5 text-white shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">Next meeting</p>
            {nextMeeting ? (
              <>
                <p className="mt-1 text-2xl font-semibold">{longDate(nextMeeting.meeting_date)}</p>
                <p className="text-sm text-brand-100">
                  {nextMeeting.title}
                  {nextMeeting.meeting_date ? ` · ${daysUntil(nextMeeting.meeting_date) === 0 ? 'today' : `in ${daysUntil(nextMeeting.meeting_date)} days`}` : ''}
                </p>
                {nextMeeting.agenda && <p className="mt-2 text-sm text-brand-100">{nextMeeting.agenda}</p>}
              </>
            ) : (
              <p className="mt-1 text-lg">No meeting scheduled yet.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/meetings" className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">Meetings</Link>
            <Link href="/meetings?tab=questions" className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">{openQs.length} open questions</Link>
          </div>
        </div>

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">December scorecard</h2>
            <Link href="/plan" className="text-sm text-brand-600 hover:underline">{scoreDone} of {scorecard.length} met</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {scorecard.map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] ${goalMet(g) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`} aria-hidden>{goalMet(g) ? '✓' : ''}</span>
                <span className={`flex-1 ${goalMet(g) ? 'text-slate-400 line-through' : ''}`}>{g.title}</span>
                {g.target_value != null && <span className="whitespace-nowrap text-xs text-slate-500">{Number(g.current_value ?? 0)} / {Number(g.target_value)}</span>}
              </li>
            ))}
            {scorecard.length === 0 && <li className="text-slate-400">No scorecard yet.</li>}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open action items" value={String(open.length)} sub={`${done} done of ${actions.rows.length}`} href="/actions" />
        <Stat label="Overdue" value={String(overdue.length)} sub={overdue.length ? 'Past their due date' : 'Nothing late'} href="/actions?view=overdue" warn={overdue.length > 0} />
        <Stat label="Due in the next 7 days" value={String(dueSoon.length)} sub={`Through ${shortDate(weekOut)}`} href="/actions?view=week" />
        <Stat label="Open questions" value={String(openQs.length)} sub="Waiting on a committee decision" href="/meetings?tab=questions" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">My action items</h2>
            <Link href="/actions?view=mine" className="text-sm text-brand-600 hover:underline">All of mine</Link>
          </div>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-400">{profile.full_name ? 'Nothing open with your name on it.' : 'Add your full name on the Team page to see your items here.'}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {mine.slice(0, 8).map((a) => <ActionLine key={a.id} a={a} />)}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Coming up in the next two weeks</h2>
            <Link href="/actions" className="text-sm text-brand-600 hover:underline">All actions</Link>
          </div>
          {comingUp.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing dated in the next two weeks.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {comingUp.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-2">
                  <span className={`w-14 shrink-0 rounded bg-slate-100 py-0.5 text-center text-xs font-semibold ${c.date < t ? 'bg-red-50 text-red-700' : ''}`}>{shortDate(c.date)}</span>
                  <Link href={c.href} className="min-w-0 flex-1 hover:underline">{c.what}</Link>
                  <span className="whitespace-nowrap text-xs text-slate-500">{c.who || c.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Progress by workstream</h2>
          <ul className="space-y-3 text-sm">
            {streams.map(([name, s]) => (
              <li key={name}>
                <div className="mb-1 flex justify-between"><span>{name}</span><span className="text-xs text-slate-500">{s.done} of {s.total} done</span></div>
                <Progress value={s.done} max={s.total} />
              </li>
            ))}
            {streams.length === 0 && <li className="text-slate-400">No action items yet.</li>}
          </ul>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-400">Changes will appear here as they happen.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {recent.map((a) => (
                <li key={a.id} className="text-slate-600">
                  <span className="text-slate-400">{new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · </span>
                  <span className="font-medium">{a.actor_name ?? 'System'}</span> {verb(a.action)} {noun(a.table_name)}
                  {a.summary ? <span className="text-slate-500"> “{a.summary}”</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function byDue(a: Row, b: Row) {
  return (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1;
}

function ActionLine({ a }: { a: Row }) {
  const late = a.due_date && a.due_date < today();
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`w-14 shrink-0 rounded py-0.5 text-center text-xs font-semibold ${late ? 'bg-red-50 text-red-700' : 'bg-slate-100'}`}>{shortDate(a.due_date)}</span>
      <span className="min-w-0 flex-1">{a.title}</span>
      {a.status === 'in_progress' && <Pill tone="gold">In progress</Pill>}
      {late && <span className="whitespace-nowrap text-xs text-red-700">{relative(a.due_date)}</span>}
    </li>
  );
}

function Stat({ label, value, sub, href, warn }: { label: string; value: string; sub?: string; href?: string; warn?: boolean }) {
  const body = (
    <div className={`card h-full ${warn ? 'border-red-200 bg-red-50' : ''}`}>
      <p className="label">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? 'text-red-700' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

const verb = (a: string) => ({ insert: 'added', update: 'updated', delete: 'removed' } as Record<string, string>)[a] ?? a;
const noun = (t: string) =>
  ({
    meetings: 'a meeting', action_items: 'an action item', decisions: 'a decision', open_questions: 'an open question', goals: 'a goal',
    spotlight_artists: 'a Spotlight artist', content_posts: 'a Spotlight post', mentors: 'a mentor', mentees: 'a mentee',
    mentoring_sessions: 'a mentoring session', partners: 'a partner', grants: 'a grant', provider_classes: 'a Florida class', documents: 'a document',
  } as Record<string, string>)[t] ?? t;
