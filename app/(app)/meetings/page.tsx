'use client';

import { useEffect, useState } from 'react';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import FilesCell from '@/components/FilesCell';
import Tabs from '@/components/Tabs';
import { useCan } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import { DECISION_STATUS, MEETING_STATUS, OWNER, QUESTION_STATUS } from '@/lib/options';
import { queryParam } from '@/lib/goals';

type Tab = 'meetings' | 'decisions' | 'questions';

export default function MeetingsPage() {
  const [tab, setTab] = useState<Tab>('meetings');
  const meetings = useLiveTable('meetings', { orderBy: 'meeting_date', ascending: false });
  const decisions = useLiveTable('decisions', { orderBy: 'sort_order' });
  const questions = useLiveTable('open_questions', { orderBy: 'sort_order' });
  useEffect(() => {
    const q = queryParam('tab');
    if (q === 'decisions' || q === 'questions') setTab(q);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Meetings & decisions</h1>
        <p className="text-sm text-slate-500">The committee meets monthly. Attach the agenda and recap to each meeting, log what was decided, and keep the open questions in front of everyone.</p>
      </header>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { key: 'meetings', label: 'Meetings', count: meetings.rows.length },
        { key: 'decisions', label: 'Decisions', count: decisions.rows.filter((d) => d.status === 'active').length },
        { key: 'questions', label: 'Open questions', count: questions.rows.filter((q) => q.status === 'open').length },
      ]} />
      <section className="card">
        {tab === 'meetings' && <Meetings t={meetings} />}
        {tab === 'decisions' && <Decisions t={decisions} meetings={meetings.rows} />}
        {tab === 'questions' && <Questions t={questions} />}
      </section>
    </div>
  );
}

function Meetings({ t }: { t: ReturnType<typeof useLiveTable> }) {
  const { canEdit } = useCan();
  const docs = useLiveTable('documents');
  const cols: Column[] = [
    { key: 'meeting_date', label: 'Date', type: 'date', width: '140px' },
    { key: 'title', label: 'Meeting', width: '180px' },
    { key: 'status', label: 'Status', type: 'select', options: MEETING_STATUS, width: '110px' },
    { key: 'agenda', label: 'Agenda', type: 'textarea', width: '260px' },
    { key: 'attendees', label: 'Attended', type: 'textarea', width: '180px' },
    { key: 'recap_link', label: 'Recap link', width: '160px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '180px' },
    { key: '_files', label: 'Files', type: 'computed', render: (r) => <FilesCell docs={docs} field="meeting_id" id={r.id} folder="committee" /> },
  ];
  return (
    <>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={t.rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ title: `Meeting ${t.rows.length + 1}`, status: 'planned' })} addLabel="Add meeting" />
    </>
  );
}

function Decisions({ t, meetings }: { t: ReturnType<typeof useLiveTable>; meetings: { id: string; title?: string }[] }) {
  const { canEdit } = useCan();
  const cols: Column[] = [
    { key: 'title', label: 'Decision', width: '200px' },
    { key: 'details', label: 'What it means', type: 'textarea', width: '320px' },
    { key: 'decided_on', label: 'Decided', type: 'date', width: '140px' },
    { key: 'meeting_id', label: 'Meeting', type: 'select', options: [{ value: '', label: '—' }, ...meetings.map((m) => ({ value: m.id, label: String(m.title) }))], width: '160px' },
    { key: 'status', label: 'Status', type: 'select', options: DECISION_STATUS, width: '130px' },
  ];
  return (
    <>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={t.rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ title: 'New decision', decided_on: new Date().toISOString().slice(0, 10) })} addLabel="Log a decision" />
    </>
  );
}

function Questions({ t }: { t: ReturnType<typeof useLiveTable> }) {
  const { canEdit } = useCan();
  const rows = [...t.rows].sort((a, b) => (a.status === 'open') !== (b.status === 'open') ? (a.status === 'open' ? -1 : 1) : (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const cols: Column[] = [
    { key: 'status', label: 'Status', type: 'select', options: QUESTION_STATUS, width: '110px' },
    { key: 'title', label: 'Question', width: '170px' },
    { key: 'details', label: 'Details', type: 'textarea', width: '320px' },
    { key: 'owner', label: 'Owner', type: 'select', options: [{ value: '', label: '—' }, ...OWNER], width: '150px' },
    { key: 'decide_by', label: 'Decide by', type: 'date', width: '140px' },
    { key: 'resolution', label: 'What we decided', type: 'textarea', width: '220px' },
  ];
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">When a question is settled, write the answer under &quot;What we decided&quot;, set it to Decided, and log it on the Decisions tab.</p>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ title: 'New question' })} addLabel="Add question" />
    </>
  );
}
