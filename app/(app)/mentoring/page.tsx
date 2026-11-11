'use client';

import { useState } from 'react';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import FilesCell from '@/components/FilesCell';
import Tabs, { Pill } from '@/components/Tabs';
import { useCan } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import { AGE_STATUS, BACKGROUND_CHECK, DISCIPLINE, MENTEE_SOURCE, MENTEE_STAGE, SESSION_FORMAT } from '@/lib/options';
import { today } from '@/lib/dates';
import type { Row } from '@/lib/types';

type Tab = 'mentees' | 'sessions' | 'mentors';
const OPEN_STAGES = ['inquiry', 'intake', 'prescreen', 'matched', 'active', 'showcase'];

export default function MentoringPage() {
  const { canEdit } = useCan();
  const [tab, setTab] = useState<Tab>(canEdit ? 'mentees' : 'mentors');
  const mentees = useLiveTable('mentees', { orderBy: 'inquiry_date' });
  const sessions = useLiveTable('mentoring_sessions', { orderBy: 'session_date', ascending: false });
  const mentors = useLiveTable('mentors', { orderBy: 'name' });

  const matched = mentees.rows.filter((m) => ['matched', 'active', 'showcase', 'ambassador'].includes(m.stage)).length;
  const noSecondAdult = sessions.rows.filter((s) => !String(s.second_adult ?? '').trim()).length;
  const unscreened = mentors.rows.filter((m) => m.active && (m.background_check !== 'on_file' || !m.code_of_conduct)).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Mentoring</h1>
        <p className="text-sm text-slate-500">Every mentee goes through intake and Dale&apos;s pre-screen call before a match. Log every session; two adults are present at each one.</p>
      </header>

      {canEdit && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Mentee pipeline</h2>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {MENTEE_STAGE.map((s, i) => (
              <li key={s.value} className={`rounded-lg p-2 text-center ${s.value === 'matched' ? 'bg-brand-700 text-white' : 'bg-slate-50'}`}>
                <p className="text-xl font-semibold">{mentees.rows.filter((m) => m.stage === s.value).length}</p>
                <p className={`text-[11px] leading-tight ${s.value === 'matched' ? 'text-brand-100' : 'text-slate-500'}`}>{i + 1}. {s.label}</p>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            <span><b>{matched}</b> matched so far</span>
            <span><b>{sessions.rows.length}</b> sessions logged</span>
            {noSecondAdult > 0 && <span className="text-red-700"><b>{noSecondAdult}</b> session{noSecondAdult === 1 ? '' : 's'} missing the second adult</span>}
            {unscreened > 0 && <span className="text-gold-800"><b>{unscreened}</b> active mentor{unscreened === 1 ? '' : 's'} without a check and code of conduct on file</span>}
          </div>
        </section>
      )}

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        ...(canEdit ? [{ key: 'mentees' as Tab, label: 'Mentees', count: mentees.rows.filter((m) => OPEN_STAGES.includes(m.stage)).length },
          { key: 'sessions' as Tab, label: 'Sessions', count: sessions.rows.length }] : []),
        { key: 'mentors', label: 'Mentors', count: mentors.rows.filter((m) => m.active).length },
      ]} />
      <section className="card">
        {tab === 'mentees' && <Mentees t={mentees} mentors={mentors.rows} sessions={sessions.rows} />}
        {tab === 'sessions' && <Sessions t={sessions} mentees={mentees.rows} mentors={mentors.rows} />}
        {tab === 'mentors' && <Mentors t={mentors} mentees={mentees.rows} />}
      </section>
    </div>
  );
}

function Mentees({ t, mentors, sessions }: { t: ReturnType<typeof useLiveTable>; mentors: Row[]; sessions: Row[] }) {
  const { canEdit } = useCan();
  const docs = useLiveTable('documents');
  const [showClosed, setShowClosed] = useState(false);
  const rows = t.rows.filter((m) => showClosed || m.stage !== 'closed');
  const cols: Column[] = [
    { key: 'name', label: 'Mentee', width: '170px' },
    { key: 'stage', label: 'Stage', type: 'select', options: MENTEE_STAGE, width: '140px' },
    { key: 'discipline', label: 'Discipline', type: 'select', options: [{ value: '', label: '—' }, ...DISCIPLINE], width: '160px' },
    { key: 'age_status', label: 'Age', type: 'select', options: AGE_STATUS, width: '110px' },
    { key: 'point_mentor_id', label: 'Point mentor', type: 'select', options: [{ value: '', label: '—' }, ...mentors.map((m) => ({ value: m.id, label: m.name }))], width: '150px' },
    { key: 'source', label: 'Found through', type: 'select', options: [{ value: '', label: '—' }, ...MENTEE_SOURCE], width: '160px' },
    { key: 'guardian_name', label: 'Parent or guardian', width: '160px' },
    { key: 'guardian_contact', label: 'Guardian contact', width: '180px' },
    { key: 'inquiry_date', label: 'Inquiry', type: 'date', width: '140px' },
    { key: 'intake_date', label: 'Intake', type: 'date', width: '140px' },
    { key: 'match_date', label: 'Matched', type: 'date', width: '140px' },
    { key: '_sessions', label: 'Sessions', type: 'computed', render: (r) => <span>{sessions.filter((s) => s.mentee_id === r.id).length}</span> },
    { key: 'outcome', label: 'Outcome', type: 'textarea', width: '180px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '200px' },
    { key: '_files', label: 'Files', type: 'computed', render: (r) => <FilesCell docs={docs} field="mentee_id" id={r.id} folder="mentoring" /> },
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <p className="text-slate-500">Private: admins and committee members only. Use a first name and last initial.</p>
        <label className="ml-auto flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed</label>
      </div>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ name: 'New mentee', stage: 'inquiry', inquiry_date: today() })} addLabel="Add mentee" />
    </>
  );
}

function Sessions({ t, mentees, mentors }: { t: ReturnType<typeof useLiveTable>; mentees: Row[]; mentors: Row[] }) {
  const { canEdit } = useCan();
  const cols: Column[] = [
    { key: 'session_date', label: 'Date', type: 'date', width: '140px' },
    { key: 'mentee_id', label: 'Mentee', type: 'select', options: [{ value: '', label: '—' }, ...mentees.map((m) => ({ value: m.id, label: m.name }))], width: '170px' },
    { key: 'mentor_id', label: 'Mentor', type: 'select', options: [{ value: '', label: '—' }, ...mentors.map((m) => ({ value: m.id, label: m.name }))], width: '150px' },
    { key: 'format', label: 'Format', type: 'select', options: SESSION_FORMAT, width: '120px' },
    { key: 'second_adult', label: 'Second adult present', width: '170px' },
    { key: '_check', label: '', type: 'computed', render: (r) => String(r.second_adult ?? '').trim() ? <Pill tone="green">Two adults</Pill> : <Pill tone="red">Add second adult</Pill> },
    { key: 'minutes', label: 'Minutes', type: 'number', width: '80px' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '240px' },
  ];
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">One row per session. These counts feed grant reports and the impact numbers funders ask for.</p>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={t.rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ session_date: today(), format: 'zoom' })} addLabel="Log a session" />
    </>
  );
}

function Mentors({ t, mentees }: { t: ReturnType<typeof useLiveTable>; mentees: Row[] }) {
  const { canEdit } = useCan();
  const docs = useLiveTable('documents');
  const load = (id: string) => mentees.filter((m) => m.point_mentor_id === id && OPEN_STAGES.includes(m.stage)).length;
  const cols: Column[] = [
    { key: 'name', label: 'Mentor', width: '160px' },
    { key: 'disciplines', label: 'Disciplines', type: 'textarea', width: '200px' },
    { key: 'location', label: 'Based in', width: '130px' },
    { key: 'background_check', label: 'Background check', type: 'select', options: BACKGROUND_CHECK, width: '140px' },
    { key: 'background_check_date', label: 'Checked on', type: 'date', width: '140px' },
    { key: 'school_level2', label: 'School Level 2', type: 'checkbox' },
    { key: 'code_of_conduct', label: 'Code of conduct', type: 'checkbox' },
    { key: '_ready', label: 'Ready', type: 'computed', render: (r) => r.background_check === 'on_file' && r.code_of_conduct ? <Pill tone="green">Ready</Pill> : <Pill tone="gold">Not yet</Pill> },
    { key: 'capacity', label: 'Capacity', type: 'number', width: '80px' },
    { key: '_load', label: 'Mentees', type: 'computed', render: (r) => <span className={r.capacity != null && load(r.id) > r.capacity ? 'font-semibold text-red-700' : ''}>{load(r.id)}{r.capacity != null ? ` / ${r.capacity}` : ''}</span> },
    { key: 'active', label: 'Active', type: 'checkbox' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '200px' },
    { key: '_files', label: 'Files', type: 'computed', render: (r) => <FilesCell docs={docs} field="mentor_id" id={r.id} folder="mentoring" /> },
  ];
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">A mentor is ready once their background check is on file and they&apos;ve signed the code of conduct. Background check reports go in Documents › Background Checks (admins only).</p>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={t.rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ name: 'New mentor' })} addLabel="Add mentor" />
    </>
  );
}
