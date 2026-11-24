'use client';

import { useEffect, useState } from 'react';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import { useCan, useProfile } from '@/components/RoleContext';
import { Avatar, DueChip, PageHeader, WorkstreamChip } from '@/components/ui';
import Icon from '@/components/Icon';
import { cellTone, firstName, workstreamTone } from '@/lib/colors';
import { useLiveTable } from '@/lib/useLiveTable';
import { ACTION_STATUS, OWNER, PEOPLE, WORKSTREAM } from '@/lib/options';
import { addDays, today } from '@/lib/dates';
import { queryParam } from '@/lib/goals';
import type { Row } from '@/lib/types';

const VIEWS = [
  { key: 'open', label: 'All open' },
  { key: 'mine', label: 'Mine' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'Everything' },
] as const;
type View = (typeof VIEWS)[number]['key'];

export default function ActionsPage() {
  const { canEdit } = useCan();
  const profile = useProfile();
  const t = useLiveTable('action_items', { orderBy: 'due_date' });
  const meetings = useLiveTable('meetings', { orderBy: 'meeting_date' });
  const [view, setView] = useState<View>('open');
  const [owner, setOwner] = useState('all');
  const [stream, setStream] = useState('all');
  const [layout, setLayout] = useState<'board' | 'list'>('board');

  useEffect(() => {
    const v = queryParam('view');
    if (v && VIEWS.some((x) => x.key === v)) setView(v as View);
    const w = queryParam('stream');
    if (w && WORKSTREAM.some((x) => x.value === w)) setStream(w);
    try {
      const saved = localStorage.getItem('actions-layout');
      if (saved === 'list' || saved === 'board') setLayout(saved);
    } catch {}
  }, []);
  const pickLayout = (l: 'board' | 'list') => {
    setLayout(l);
    if (l === 'board' && (view === 'done' || view === 'all')) setView('open');
    try { localStorage.setItem('actions-layout', l); } catch {}
  };

  const now = today();
  const isMine = (a: Row) => !!profile.full_name && (a.owner === profile.full_name || a.owner === 'All members' || a.owner?.startsWith((profile.full_name ?? '').split(' ')[0] + ' '));
  const inView = (a: Row) => {
    const open = a.status !== 'done';
    switch (view) {
      case 'open': return open;
      case 'mine': return open && isMine(a);
      case 'overdue': return open && !!a.due_date && a.due_date < now;
      case 'week': return open && !!a.due_date && a.due_date >= now && a.due_date <= addDays(now, 7);
      case 'done': return !open;
      default: return true;
    }
  };
  // The board shows every status as a column, so only the who/when part of the view applies.
  const inBoardView = (a: Row) => {
    switch (view) {
      case 'mine': return isMine(a);
      case 'overdue': return a.status !== 'done' && !!a.due_date && a.due_date < now;
      case 'week': return a.status !== 'done' && !!a.due_date && a.due_date >= now && a.due_date <= addDays(now, 7);
      default: return true;
    }
  };
  const boardRows = t.rows.filter((a) => inBoardView(a) && (owner === 'all' || a.owner === owner) && (stream === 'all' || a.workstream === stream));
  const rows = t.rows
    .filter((a) => inView(a) && (owner === 'all' || a.owner === owner) && (stream === 'all' || a.workstream === stream))
    .sort((a, b) => (a.status === 'done') !== (b.status === 'done') ? (a.status === 'done' ? 1 : -1) : (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : (a.due_date ?? '9999') > (b.due_date ?? '9999') ? 1 : (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const openByOwner = PEOPLE.map((p) => ({ p, n: t.rows.filter((a) => a.owner === p && a.status !== 'done').length, late: t.rows.filter((a) => a.owner === p && a.status !== 'done' && a.due_date && a.due_date < now).length }))
    .filter((x) => x.n > 0);

  const meetingOptions = [{ value: '', label: '—' }, ...meetings.rows.map((m) => ({ value: m.id, label: m.title }))];
  const cols: Column[] = [
    { key: 'status', label: 'Status', type: 'select', options: ACTION_STATUS, width: '130px' },
    { key: 'title', label: 'Action', type: 'textarea', width: '300px' },
    { key: 'owner', label: 'Owner', type: 'select', options: [{ value: '', label: '—' }, ...OWNER], width: '150px' },
    { key: 'due_date', label: 'Due', type: 'date', width: '140px' },
    {
      key: '_when', label: '', type: 'computed', render: (r) => r.status === 'done'
        ? <span className="text-xs text-green-700">Done{r.done_on ? ` ${r.done_on.slice(5)}` : ''}</span>
        : <DueChip due={r.due_date} status={r.status} today={now} />,
    },
    { key: 'workstream', label: 'Workstream', type: 'select', options: [{ value: '', label: '—' }, ...WORKSTREAM], width: '150px' },
    { key: 'proposed', label: 'Proposed', type: 'checkbox' },
    { key: 'meeting_id', label: 'From meeting', type: 'select', options: meetingOptions, width: '150px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '200px' },
  ];

  const lateCount = t.rows.filter((a) => a.status !== 'done' && a.due_date && a.due_date < now).length;
  const doneCount = t.rows.filter((a) => a.status === 'done').length;
  const views = layout === 'board' ? VIEWS.filter((v) => !['done', 'all'].includes(v.key)) : VIEWS;
  const VIEW_LABEL: Record<string, string> = { open: layout === 'board' ? 'Everyone' : 'All open' };
  const addItem = () => t.insert({ title: 'New action item', owner: owner === 'all' ? null : owner, workstream: stream === 'all' ? null : stream, due_date: addDays(now, 7) });

  return (
    <div className="space-y-5">
      <PageHeader href="/actions" title="Action items"
        actions={<>
          <div role="group" aria-label="Layout" className="inline-flex rounded-xl bg-slate-200/70 p-1">
            {(['board', 'list'] as const).map((l) => (
              <button key={l} onClick={() => pickLayout(l)} aria-pressed={layout === l}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${layout === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                <Icon name={l === 'board' ? 'board' : 'list'} className="h-4 w-4" />{l === 'board' ? 'Board' : 'List'}
              </button>
            ))}
          </div>
          {canEdit && <button className="btn-primary" onClick={addItem}>+ Add item</button>}
        </>}>
        {t.rows.length} items · {doneCount} done{lateCount ? <> · <span className="font-semibold text-red-700">{lateCount} overdue</span></> : null}. Owners keep their own items current; everyone sees changes right away.
      </PageHeader>

      <section className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          {views.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)} aria-pressed={view === v.key}
              className={`min-h-[36px] rounded-full border px-3.5 text-sm font-semibold ${view === v.key
                ? (v.key === 'overdue' ? 'border-red-600 bg-red-600 text-white' : 'border-brand-700 bg-brand-700 text-white')
                : v.key === 'overdue' ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {VIEW_LABEL[v.key] ?? v.label}{v.key === 'overdue' && lateCount ? ` · ${lateCount}` : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {WORKSTREAM.filter((w) => t.rows.some((a) => a.workstream === w.value)).map((w) => {
            const on = stream === w.value;
            const tone = workstreamTone(w.value);
            return (
              <button key={w.value} onClick={() => setStream(on ? 'all' : w.value)} aria-pressed={on}
                className={`inline-flex min-h-[32px] items-center gap-2 rounded-full px-3 text-xs font-semibold ${on ? `${tone.chip} ring-2 ring-current` : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />{w.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {openByOwner.map(({ p, n, late }) => {
            const on = owner === p;
            return (
              <button key={p} onClick={() => setOwner(on ? 'all' : p)} aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold ${on ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <Avatar name={p} size="h-6 w-6 text-[9px]" />
                {firstName(p)} <span className="font-normal text-slate-500">{n}</span>
                {late ? <span className="rounded-full bg-red-100 px-1.5 text-[11px] text-red-800">{late} late</span> : null}
              </button>
            );
          })}
          {(owner !== 'all' || stream !== 'all') && (
            <button className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => { setOwner('all'); setStream('all'); }}>Clear filters</button>
          )}
        </div>
      </section>

      {view === 'mine' && !profile.full_name && <p className="text-sm text-gold-800">Your name isn&apos;t set on your account yet, so &quot;Mine&quot; can&apos;t match you. An admin can add it on the Team page.</p>}
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />

      {layout === 'board' ? (
        <Board rows={boardRows} canEdit={canEdit} now={now} onStatus={(id, status) => t.update(id, { status })} />
      ) : (
        <section className="card">
          <p className="mb-2 text-right text-sm text-slate-500">{rows.length} shown</p>
          <EditableTable rows={rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
            onAdd={addItem} addLabel="Add action item" empty="Nothing in this view." />
        </section>
      )}
    </div>
  );
}

const COLUMNS = [
  { key: 'not_started', label: 'Not started', dot: 'bg-slate-400', bg: 'bg-slate-200/60' },
  { key: 'in_progress', label: 'In progress', dot: 'bg-amber-500', bg: 'bg-amber-100/60' },
  { key: 'blocked', label: 'Blocked', dot: 'bg-red-500', bg: 'bg-red-100/50' },
  { key: 'done', label: 'Done', dot: 'bg-green-500', bg: 'bg-green-100/60' },
] as const;

function Board({ rows, canEdit, now, onStatus }: { rows: Row[]; canEdit: boolean; now: string; onStatus: (id: string, status: string) => void }) {
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const sorted = [...rows].sort((a, b) => (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : (a.due_date ?? '9999') > (b.due_date ?? '9999') ? 1 : (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((c) => {
        let list = sorted.filter((a) => (a.status ?? 'not_started') === c.key);
        if (c.key === 'done') list = list.sort((a, b) => ((a.done_on ?? '') < (b.done_on ?? '') ? 1 : -1));
        const limit = c.key === 'done' ? 5 : 8;
        const shown = showAll[c.key] ? list : list.slice(0, limit);
        return (
          <section key={c.key} className={`rounded-2xl p-3 ${c.bg}`}>
            <div className="flex items-center gap-2 px-1.5 pb-3 pt-1">
              <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
              <h2 className="text-sm font-bold">{c.label}</h2>
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">{list.length}</span>
            </div>
            <div className="space-y-2.5">
              {shown.map((a) => (
                <article key={a.id} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                  {a.workstream && <div className="mb-2"><WorkstreamChip value={a.workstream} /></div>}
                  <p className={`text-sm font-medium leading-snug ${a.status === 'done' ? 'text-slate-500 line-through decoration-slate-300' : ''}`}>{a.title}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {a.owner ? <><Avatar name={a.owner} size="h-6 w-6 text-[9px]" /><span className="text-xs font-medium text-slate-600">{firstName(a.owner)}</span></> : <span className="text-xs text-slate-400">No owner</span>}
                    <span className="ml-auto"><DueChip due={a.due_date} status={a.status} today={now} /></span>
                  </div>
                  {canEdit && (
                    <select className={`pill-select mt-3 ${cellTone('status', a.status ?? 'not_started')?.chip ?? ''}`} value={a.status ?? 'not_started'}
                      onChange={(e) => onStatus(a.id, e.target.value)} aria-label={`Status of ${a.title}`}>
                      {ACTION_STATUS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </article>
              ))}
              {list.length === 0 && <p className="px-2 py-5 text-center text-sm text-slate-500">{c.key === 'blocked' ? 'Nothing blocked right now.' : 'Nothing here.'}</p>}
              {list.length > limit && (
                <button className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white/60"
                  onClick={() => setShowAll((s) => ({ ...s, [c.key]: !s[c.key] }))}>
                  {showAll[c.key] ? 'Show fewer' : `Show ${list.length - limit} more`}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
