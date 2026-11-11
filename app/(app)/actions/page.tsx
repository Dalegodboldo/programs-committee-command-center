'use client';

import { useEffect, useState } from 'react';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import { useCan, useProfile } from '@/components/RoleContext';
import { Pill } from '@/components/Tabs';
import { useLiveTable } from '@/lib/useLiveTable';
import { ACTION_STATUS, OWNER, PEOPLE, WORKSTREAM } from '@/lib/options';
import { addDays, relative, today } from '@/lib/dates';
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

  useEffect(() => {
    const v = queryParam('view');
    if (v && VIEWS.some((x) => x.key === v)) setView(v as View);
  }, []);

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
        : r.due_date && r.due_date < now ? <Pill tone="red">{relative(r.due_date)}</Pill>
        : <span className="text-xs text-slate-500">{relative(r.due_date)}</span>,
    },
    { key: 'workstream', label: 'Workstream', type: 'select', options: [{ value: '', label: '—' }, ...WORKSTREAM], width: '150px' },
    { key: 'proposed', label: 'Proposed', type: 'checkbox' },
    { key: 'meeting_id', label: 'From meeting', type: 'select', options: meetingOptions, width: '150px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '200px' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Action items</h1>
        <p className="text-sm text-slate-500">Owners keep their own items current. Change the status here and everyone sees it right away.</p>
      </header>

      <section className="flex flex-wrap gap-2">
        {openByOwner.map(({ p, n, late }) => (
          <button key={p} onClick={() => { setOwner(owner === p ? 'all' : p); setView('open'); }}
            className={`rounded-xl border px-3 py-2 text-left text-sm ${owner === p ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <span className="block font-medium">{p}</span>
            <span className="text-xs text-slate-500">{n} open{late ? <span className="text-red-700"> · {late} late</span> : null}</span>
          </button>
        ))}
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {VIEWS.map((v) => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`rounded-lg px-3 py-1.5 text-sm ${view === v.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <select className="input !w-44" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
            <option value="all">Any owner</option>
            {PEOPLE.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input !w-44" value={stream} onChange={(e) => setStream(e.target.value)} aria-label="Workstream">
            <option value="all">Any workstream</option>
            {WORKSTREAM.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <span className="ml-auto text-sm text-slate-500">{rows.length} shown</span>
        </div>
        {view === 'mine' && !profile.full_name && <p className="mb-3 text-sm text-gold-800">Your name isn&apos;t set on your account yet, so &quot;Mine&quot; can&apos;t match you. An admin can add it on the Team page.</p>}
        <ErrorBar error={t.error} onClose={() => t.setError(null)} />
        <EditableTable rows={rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
          onAdd={() => t.insert({ title: 'New action item', owner: owner === 'all' ? null : owner, workstream: stream === 'all' ? null : stream, due_date: addDays(now, 7) })}
          addLabel="Add action item" empty="Nothing in this view." />
      </section>
    </div>
  );
}
