'use client';

import { Fragment, useState } from 'react';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import { useCan } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import type { Row } from '@/lib/types';

const ROLES = [
  { value: '', label: 'No access' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Committee member' },
  { value: 'viewer', label: 'Viewer (read-only)' },
];

export default function TeamPage() {
  const { isAdmin } = useCan();
  const people = useLiveTable('profiles', { orderBy: 'created_at' });
  const members = people.rows.filter((p) => p.role);
  const pending = people.rows.filter((p) => !p.role && !p.declined);
  const declined = people.rows.filter((p) => !p.role && p.declined);

  const cols: Column[] = [
    { key: 'full_name', label: 'Name', width: '180px' },
    { key: 'email', label: 'Email', width: '220px', editable: false },
    { key: 'role', label: 'Access', type: 'select', options: ROLES, width: '180px' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? 'People request access from the sign-in page. Approve them here; set their access to "No access" to remove them.'
            : 'People with access to this dashboard. Admins manage access.'}
        </p>
      </header>

      <ErrorBar error={people.error} onClose={() => people.setError(null)} />

      {isAdmin && (
        <section className={`card ${pending.length ? 'border-amber-300' : ''}`}>
          <h2 className="mb-1 font-semibold">Access requests {pending.length > 0 && <span className="text-amber-700">({pending.length})</span>}</h2>
          <p className="mb-3 text-sm text-slate-500">Confirm with the person directly before approving: anyone can type any email into the request form.</p>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400">No pending requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map((p) => <Request key={p.id} person={p} onUpdate={people.update} />)}
            </ul>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Members</h2>
        <EditableTable
          rows={members}
          columns={cols}
          canEdit={isAdmin}
          onUpdate={(id, patch) => people.update(id, 'role' in patch ? { role: patch.role || null } : patch)}
        />
      </section>

      {isAdmin && declined.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Declined</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            {declined.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>{p.full_name} · {p.email}</span>
                <button className="text-xs text-brand-600 hover:underline" onClick={() => people.update(p.id, { declined: false })}>
                  Move back to requests
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && <EmailCheck />}

      <RoleMatrix />
    </div>
  );
}

function Request({ person, onUpdate }: { person: Row; onUpdate: (id: string, patch: Record<string, any>) => void }) {
  const [role, setRole] = useState('member');
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{person.full_name} <span className="font-normal text-slate-500">· {person.email}</span></p>
        {person.request_note && <p className="mt-0.5 text-slate-600">“{person.request_note}”</p>}
        <p className="mt-0.5 text-xs text-slate-400">Requested {new Date(person.requested_at ?? person.created_at).toLocaleString()}
          {person.requested_at && person.requested_at !== person.created_at ? ' · asked again' : ''}</p>
      </div>
      <div className="flex items-center gap-2">
        <select className="input !w-48" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.filter((r) => r.value).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button className="btn bg-green-600 text-white hover:bg-green-700" onClick={() => onUpdate(person.id, { role, declined: false })}>Approve</button>
        <button className="btn-ghost" onClick={() => onUpdate(person.id, { declined: true })}>Decline</button>
      </div>
    </li>
  );
}

function EmailCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; reason?: string; recipients?: string[] } | null>(null);
  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch('/api/test-notify', { method: 'POST' });
    setResult(await res.json().catch(() => ({ ok: false, reason: `Unexpected response (${res.status}).` })));
    setBusy(false);
  }
  return (
    <section className="card text-sm">
      <h2 className="mb-1 font-semibold">Email alerts</h2>
      <p className="mb-3 text-slate-500">Admins get an email when someone requests access. Send a test to check it works.</p>
      <button className="btn-ghost" onClick={run} disabled={busy}>{busy ? 'Sending…' : 'Send test email'}</button>
      {result && (
        <p className={`mt-3 ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
          {result.ok ? `Sent to ${result.recipients?.join(', ')}. Check that inbox (and spam).` : result.reason}
        </p>
      )}
    </section>
  );
}

// Mirrors the database rules in supabase/schema.sql. If those change, update this table too.
// Y = yes, N = no, otherwise a short note.
const MATRIX: { area: string; rows: [string, string, string, string][] }[] = [
  {
    area: 'Everyday work',
    rows: [
      ['See action items, meetings, decisions, goals, partners, grants and Florida classes', 'Y', 'Y', 'Y'],
      ['Add, edit and delete those records', 'Y', 'Y', 'N'],
      ['See mentors', 'Y', 'Y', 'Y'],
      ['Edit mentors', 'Y', 'Y', 'N'],
    ],
  },
  {
    area: 'Private records (minors and family contacts)',
    rows: [
      ['See and edit the Spotlight roster and guardian contacts', 'Y', 'Y', 'N'],
      ['See and edit mentees and mentoring sessions', 'Y', 'Y', 'N'],
    ],
  },
  {
    area: 'Documents',
    rows: [
      ['See shared folders (meetings, plans, policies, partners, grants, Florida, showcases, marketing, templates)', 'Y', 'Y', 'Y'],
      ['See Spotlight, Releases & Consent, and Mentoring & Intake folders', 'Y', 'Y', 'N'],
      ['See Background Checks and Admin only folders', 'Y', 'N', 'N'],
      ['Upload, move and attach files', 'Y', 'Y', 'N'],
      ['Delete files', 'Y', 'Own uploads', 'N'],
    ],
  },
  {
    area: 'Ask Claude',
    rows: [
      ['Ask questions, get summaries, search documents (only what that role can see)', 'Y', 'Y', 'Y'],
      ['Small edits to action items, meetings, decisions, questions, goals, partners, grants and classes (after Confirm)', 'Y', 'Y', 'N'],
      ['Change people, access, files, code or settings', 'N', 'N', 'N'],
    ],
  },
  {
    area: 'Administration',
    rows: [
      ['Approve or decline access requests', 'Y', 'N', 'N'],
      ['Change anyone\'s access level', 'Y', 'N', 'N'],
      ['Test email alerts', 'Y', 'N', 'N'],
      ['Back up everything (export)', 'Y', 'N', 'N'],
    ],
  },
];

function Cell({ v }: { v: string }) {
  if (v === 'Y') return <span className="font-semibold text-green-700" aria-label="Yes">✓</span>;
  if (v === 'N') return <span className="text-slate-300" aria-label="No">—</span>;
  return <span className="text-xs text-amber-700">{v}</span>;
}

function RoleMatrix() {
  const heads = ['Admin', 'Committee member', 'Viewer'];
  return (
    <section className="card text-sm text-slate-700">
      <h2 className="mb-1 font-semibold text-slate-900">What each role can and can&apos;t do</h2>
      <p className="mb-3 text-slate-500">The database enforces these rules, so they hold no matter which page or tool someone uses.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium"></th>
              {heads.map((h) => <th key={h} className="w-28 px-2 py-2 text-center font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((g) => (
              <Fragment key={g.area}>
                <tr><td colSpan={4} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.area}</td></tr>
                {g.rows.map(([label, ...vals]) => (
                  <tr key={label} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{label}</td>
                    {vals.map((v, i) => <td key={i} className="px-2 py-2 text-center"><Cell v={v} /></td>)}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">Viewer suits board members and advisors. Committee members never need to see background check reports; those stay with admins.</p>
    </section>
  );
}
