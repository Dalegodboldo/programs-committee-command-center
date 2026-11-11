'use client';

import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import { Progress } from '@/components/Tabs';
import { useCan } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import { goalMet } from '@/lib/goals';
import { shortDate } from '@/lib/dates';

const SAFETY = [
  'Contact the adult, never the child. No DMs to a minor’s own account.',
  'No signed media release, no post.',
  'First names only in anything public. No school, hometown or age.',
  'Two adults in every mentoring session: the guardian or a second AITCF adult.',
  'Background check (through Checkr) and signed code of conduct before any session.',
  'A guardian travels with every minor; signed consent and medical form for showcases.',
];
const PATH = [
  'Found through an outreach path',
  'Parent or guardian contacted first',
  'Intake form submitted',
  'Dale’s pre-screen call with the parent',
  'Matched: point mentor plus the team',
  'Sessions logged (two adults present)',
  'Showcase invite, then ambassador',
];
const RHYTHM = [
  { day: 'Monday', name: 'The Spotlight', what: 'One artist, their best work' },
  { day: 'Wednesday', name: 'Mentor Moment', what: 'A mentor reacts with one tip' },
  { day: 'Friday', name: 'Open Call Friday', what: 'Best #AITCFSpotlight submission' },
];

export default function PlanPage() {
  const { canEdit } = useCan();
  const goals = useLiveTable('goals', { orderBy: 'sort_order' });
  const of = (c: string) => goals.rows.filter((g) => g.category === c).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const scorecard = of('scorecard');
  const roadmap = of('roadmap');
  const targets = of('target');

  const countCols = (label: string): Column[] => [
    { key: 'done', label: 'Met', type: 'checkbox' },
    { key: 'title', label, type: 'textarea', width: '320px' },
    { key: 'current_value', label: 'So far', type: 'number', width: '80px' },
    { key: 'target_value', label: 'Target', type: 'number', width: '80px' },
    { key: 'target_date', label: 'By', type: 'date', width: '140px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '200px' },
  ];
  const roadmapCols: Column[] = [
    { key: 'done', label: 'Gate passed', type: 'checkbox' },
    { key: 'title', label: 'Phase', type: 'textarea', width: '360px' },
    { key: 'gate', label: 'Gate to move on', type: 'textarea', width: '220px' },
    { key: 'target_date', label: 'Ends', type: 'date', width: '140px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '180px' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Plan & goals</h1>
        <p className="text-sm text-slate-500">What we&apos;re aiming for, how we know we got there, and the rules every member follows. Update the &quot;So far&quot; numbers as things happen.</p>
      </header>
      <ErrorBar error={goals.error} onClose={() => goals.setError(null)} />

      <section className="card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Done by the December meeting</h2>
          <span className="text-sm text-slate-500">{scorecard.filter(goalMet).length} of {scorecard.length} met</span>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scorecard.map((g) => (
            <div key={g.id} className={`rounded-xl border p-3 ${goalMet(g) ? 'border-green-200 bg-green-50' : 'border-slate-200'}`}>
              <p className="text-sm font-medium">{g.title}</p>
              {g.target_value != null ? (
                <div className="mt-2 space-y-1">
                  <Progress value={Number(g.current_value ?? 0)} max={Number(g.target_value)} />
                  <p className="text-xs text-slate-500">{Number(g.current_value ?? 0)} of {Number(g.target_value)}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{goalMet(g) ? 'Met' : 'Not yet'}</p>
              )}
            </div>
          ))}
        </div>
        {canEdit && <EditableTable rows={scorecard} columns={countCols('Goal')} canEdit={canEdit} onUpdate={goals.update} onDelete={goals.remove}
          onAdd={() => goals.insert({ title: 'New goal', category: 'scorecard' })} addLabel="Add goal" />}
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Spotlight roadmap</h2>
        <p className="mb-4 text-sm text-slate-500">Four phases build to Spotlight Live: Nashville. Each phase is gated on the one before it.</p>
        <ol className="mb-5 grid gap-3 md:grid-cols-4">
          {roadmap.map((g, i) => {
            const [name, ...rest] = String(g.title).split(':');
            return (
              <li key={g.id} className={`rounded-xl border p-3 ${g.done ? 'border-green-200 bg-green-50' : i === roadmap.findIndex((x) => !x.done) ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-800">{g.done ? 'Done' : `Ends ${shortDate(g.target_date)}`}</p>
                <p className="mt-1 text-sm font-semibold">{name}</p>
                <p className="mt-1 text-xs text-slate-600">{rest.join(':').trim()}</p>
                {g.gate && <p className="mt-2 border-t border-slate-200 pt-2 text-xs"><span className="font-medium">Gate:</span> {g.gate}</p>}
              </li>
            );
          })}
        </ol>
        {canEdit && <EditableTable rows={roadmap} columns={roadmapCols} canEdit={canEdit} onUpdate={goals.update} onDelete={goals.remove}
          onAdd={() => goals.insert({ title: 'New phase: what happens', category: 'roadmap' })} addLabel="Add phase" />}
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">First-year targets</h2>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((g) => (
            <div key={g.id}>
              <div className="mb-1 flex justify-between gap-2 text-sm"><span>{g.title}</span><span className="whitespace-nowrap font-semibold">{Number(g.current_value ?? 0)} / {Number(g.target_value ?? 0)}</span></div>
              <Progress value={Number(g.current_value ?? 0)} max={Number(g.target_value ?? 0)} tone="gold" />
            </div>
          ))}
        </div>
        {canEdit && <EditableTable rows={targets} columns={countCols('Target')} canEdit={canEdit} onUpdate={goals.update} onDelete={goals.remove}
          onAdd={() => goals.insert({ title: 'New target', category: 'target', target_value: 1, current_value: 0 })} addLabel="Add target" />}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-brand-700 p-5 text-white shadow-sm">
          <h2 className="mb-3 font-semibold">🛡️ Safety rules, no exceptions</h2>
          <ol className="space-y-2 text-sm">
            {SAFETY.map((s, i) => (
              <li key={s} className="flex gap-3"><span className="w-5 shrink-0 font-semibold text-gold-400">{String(i + 1).padStart(2, '0')}</span><span>{s}</span></li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">The mentee path</h2>
          <ol className="space-y-2 text-sm">
            {PATH.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i === 4 ? 'bg-brand-700 text-white' : 'border border-gold-400 bg-gold-100'}`}>{i + 1}</span>
                <span className={i === 4 ? 'font-semibold' : ''}>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">Track every mentee from day one: inquiry date, intake, match date, sessions and outcome (Mentoring page).</p>
        </div>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">The weekly Spotlight rhythm</h2>
          <span className="text-xs text-slate-500">Socials, website and email · #AITCFSpotlight</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {RHYTHM.map((r) => (
            <div key={r.day} className="rounded-xl bg-gold-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-800">{r.day}</p>
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-slate-600">{r.what}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
