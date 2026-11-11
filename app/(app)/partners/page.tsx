'use client';

import { useEffect, useState } from 'react';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import FilesCell from '@/components/FilesCell';
import Tabs, { Pill } from '@/components/Tabs';
import { useCan } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import { CLASS_DELIVERY, CLASS_STATUS, GRANT_STATUS, OWNER, PARTNER_KIND, PARTNER_STATUS, REGION } from '@/lib/options';
import { relative, today } from '@/lib/dates';
import { queryParam } from '@/lib/goals';

type Tab = 'partners' | 'grants' | 'florida';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function PartnersPage() {
  const [tab, setTab] = useState<Tab>('partners');
  const partners = useLiveTable('partners', { orderBy: 'name' });
  const grants = useLiveTable('grants', { orderBy: 'deadline' });
  const classes = useLiveTable('provider_classes', { orderBy: 'created_at' });
  useEffect(() => {
    const q = queryParam('tab');
    if (q === 'grants' || q === 'florida') setTab(q);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Partners & funding</h1>
        <p className="text-sm text-slate-500">Schools, community groups, venues and funders that feed and host the program, plus grants and the Florida provider listing.</p>
      </header>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { key: 'partners', label: 'Partners', count: partners.rows.length },
        { key: 'grants', label: 'Grants', count: grants.rows.length },
        { key: 'florida', label: 'Florida provider classes', count: classes.rows.length },
      ]} />
      {tab === 'partners' && <Partners t={partners} />}
      {tab === 'grants' && <Grants t={grants} />}
      {tab === 'florida' && <Classes t={classes} />}
    </div>
  );
}

function Partners({ t }: { t: ReturnType<typeof useLiveTable> }) {
  const { canEdit } = useCan();
  const docs = useLiveTable('documents');
  const [region, setRegion] = useState('all');
  const [status, setStatus] = useState('all');
  const now = today();
  const rows = t.rows.filter((p) => (region === 'all' || p.region === region) && (status === 'all' || p.status === status));
  const cols: Column[] = [
    { key: 'name', label: 'Partner', width: '200px' },
    { key: 'status', label: 'Status', type: 'select', options: PARTNER_STATUS, width: '130px' },
    { key: 'kind', label: 'Type', type: 'select', options: [{ value: '', label: '—' }, ...PARTNER_KIND], width: '170px' },
    { key: 'region', label: 'Region', type: 'select', options: [{ value: '', label: '—' }, ...REGION], width: '140px' },
    { key: 'owner', label: 'Owner', type: 'select', options: [{ value: '', label: '—' }, ...OWNER], width: '150px' },
    { key: 'next_step', label: 'Next step', type: 'textarea', width: '200px' },
    { key: 'next_step_date', label: 'By', type: 'date', width: '140px' },
    { key: '_late', label: '', type: 'computed', render: (r) => r.next_step_date && r.next_step_date < now && !['declined', 'paused', 'active'].includes(r.status) ? <Pill tone="red">{relative(r.next_step_date)}</Pill> : null },
    { key: 'contact_name', label: 'Contact', width: '150px' },
    { key: 'contact_email', label: 'Contact email', width: '180px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '220px' },
    { key: '_files', label: 'Files', type: 'computed', render: (r) => <FilesCell docs={docs} field="partner_id" id={r.id} folder="partners" /> },
  ];
  return (
    <>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {PARTNER_STATUS.map((s) => (
          <button key={s.value} onClick={() => setStatus(status === s.value ? 'all' : s.value)}
            className={`card p-2 text-center ${status === s.value ? 'ring-2 ring-brand-600' : ''}`}>
            <p className="text-xl font-semibold">{t.rows.filter((p) => p.status === s.value).length}</p>
            <p className="text-[11px] text-slate-500">{s.label}</p>
          </button>
        ))}
      </section>
      <section className="card">
        <div className="mb-3 flex flex-wrap gap-1">
          {[{ value: 'all', label: 'All regions' }, ...REGION].map((r) => (
            <button key={r.value} onClick={() => setRegion(r.value)}
              className={`rounded-lg px-3 py-1.5 text-sm ${region === r.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <ErrorBar error={t.error} onClose={() => t.setError(null)} />
        <EditableTable rows={rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
          onAdd={() => t.insert({ name: 'New partner', region: region === 'all' ? null : region })} addLabel="Add partner" />
      </section>
    </>
  );
}

function Grants({ t }: { t: ReturnType<typeof useLiveTable> }) {
  const { canEdit } = useCan();
  const docs = useLiveTable('documents');
  const now = today();
  const pipeline = t.rows.filter((g) => ['researching', 'writing', 'submitted'].includes(g.status)).reduce((s, g) => s + Number(g.amount ?? 0), 0);
  const awarded = t.rows.filter((g) => ['awarded', 'reporting', 'closed'].includes(g.status)).reduce((s, g) => s + Number(g.amount ?? 0), 0);
  const nextDeadline = t.rows.filter((g) => g.deadline && g.deadline >= now && ['researching', 'writing'].includes(g.status)).sort((a, b) => (a.deadline < b.deadline ? -1 : 1))[0];
  const cols: Column[] = [
    { key: 'funder', label: 'Funder', width: '180px' },
    { key: 'program', label: 'Program or purpose', type: 'textarea', width: '200px' },
    { key: 'status', label: 'Status', type: 'select', options: GRANT_STATUS, width: '130px' },
    { key: 'amount', label: 'Amount', type: 'money', width: '110px' },
    { key: 'deadline', label: 'Deadline', type: 'date', width: '140px' },
    { key: '_when', label: '', type: 'computed', render: (r) => r.deadline && ['researching', 'writing'].includes(r.status) ? <span className={`text-xs ${r.deadline < now ? 'text-red-700' : 'text-slate-500'}`}>{relative(r.deadline)}</span> : null },
    { key: 'region', label: 'Region', type: 'select', options: [{ value: '', label: '—' }, ...REGION], width: '140px' },
    { key: 'owner', label: 'Owner', type: 'select', options: [{ value: '', label: '—' }, ...OWNER], width: '150px' },
    { key: 'report_due', label: 'Report due', type: 'date', width: '140px' },
    { key: 'link', label: 'Link', width: '160px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '200px' },
    { key: '_files', label: 'Files', type: 'computed', render: (r) => <FilesCell docs={docs} field="grant_id" id={r.id} folder="grants" /> },
  ];
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card"><p className="label">In the pipeline</p><p className="mt-1 text-2xl font-semibold">{money(pipeline)}</p><p className="text-xs text-slate-500">Researching, writing or submitted</p></div>
        <div className="card"><p className="label">Awarded</p><p className="mt-1 text-2xl font-semibold text-brand-700">{money(awarded)}</p></div>
        <div className="card"><p className="label">Next deadline</p><p className="mt-1 text-lg font-semibold">{nextDeadline ? nextDeadline.funder : 'None set'}</p><p className="text-xs text-slate-500">{nextDeadline ? `${nextDeadline.deadline} · ${relative(nextDeadline.deadline)}` : 'Add deadlines as Jenn finds grants'}</p></div>
      </section>
      <section className="card">
        <ErrorBar error={t.error} onClose={() => t.setError(null)} />
        <EditableTable rows={t.rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
          onAdd={() => t.insert({ funder: 'New funder', owner: 'Jenn Kramer' })} addLabel="Add grant"
          empty="No grants logged yet. Jenn found several mentorship grants in Florida and California; add each one here with its deadline." />
      </section>
    </>
  );
}

function Classes({ t }: { t: ReturnType<typeof useLiveTable> }) {
  const { canEdit } = useCan();
  const docs = useLiveTable('documents');
  const cols: Column[] = [
    { key: 'title', label: 'Class', width: '180px' },
    { key: 'mentor', label: 'Taught by', width: '150px' },
    { key: 'status', label: 'Status', type: 'select', options: CLASS_STATUS, width: '170px' },
    { key: 'synopsis', label: 'Synopsis', type: 'textarea', width: '280px' },
    { key: 'delivery', label: 'Delivery', type: 'select', options: CLASS_DELIVERY, width: '150px' },
    { key: 'frequency', label: 'How often', width: '120px' },
    { key: 'price', label: 'Price', type: 'money', width: '100px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '180px' },
    { key: '_files', label: 'Syllabus', type: 'computed', render: (r) => <FilesCell docs={docs} field="class_id" id={r.id} folder="florida" /> },
  ];
  return (
    <section className="card">
      <ol className="mb-4 grid gap-2 text-sm sm:grid-cols-4">
        {['Dale and Chasen meet Casey to start the provider application', 'Each mentor sends Jenn a short class synopsis', 'Jenn writes syllabi to Florida standards', 'Classes are listed; families pay with state scholarship funds'].map((s, i) => (
          <li key={s} className="rounded-lg bg-gold-50 p-3"><span className="font-semibold text-gold-800">{i + 1}.</span> {s}</li>
        ))}
      </ol>
      <p className="mb-3 text-xs text-slate-500">Scholarship program name, award amounts and provider rules are still to be confirmed with Casey (open question).</p>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={t.rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ title: 'New class idea' })} addLabel="Add class idea" empty="No class ideas yet. Each mentor can add one here and send the synopsis to Jenn." />
    </section>
  );
}
