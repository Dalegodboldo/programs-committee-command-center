'use client';

import { Fragment, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import { useCan, useProfile } from '@/components/RoleContext';
import { supabaseBrowser } from '@/lib/supabase/client';
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
    { key: 'weekly_email', label: 'Weekly email', type: 'checkbox', width: '110px' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader href="/team" title="Team">
        {isAdmin
            ? 'People request access from the sign-in page. Approve them here; set their access to "No access" to remove them.'
            : 'People with access to this dashboard. Admins manage access.'}
      </PageHeader>

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

      <WeeklyEmail people={people.rows} isAdmin={isAdmin} onChanged={people.reload} />

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

// The Monday email: each person's switch, plus setup status, preview and test for admins.
function WeeklyEmail({ people, isAdmin, onChanged }: { people: Row[]; isAdmin: boolean; onChanged: () => void }) {
  const profile = useProfile();
  const me = people.find((p) => p.id === profile.id);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  const [preview, setPreview] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; reason?: string; to?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) fetch('/api/digest/status').then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => {});
  }, [isAdmin]);

  const on = me ? me.weekly_email !== false : true;
  const supported = !me || 'weekly_email' in me;
  async function toggle() {
    setSaving(true);
    setErr(null);
    const { error } = await supabaseBrowser().rpc('set_my_weekly_email', { on_off: !on });
    if (!error) onChanged();
    if (error) setErr(error.message.includes('set_my_weekly_email') ? 'The weekly email switch isn’t set up yet. An admin needs to run 008_weekly_email.sql in Supabase.' : error.message);
    setSaving(false);
  }
  async function sendTest() {
    setBusy(true);
    setTest(null);
    const res = await fetch('/api/digest/test', { method: 'POST' });
    setTest(await res.json().catch(() => ({ ok: false, reason: `Unexpected response (${res.status}).` })));
    setBusy(false);
  }
  const receiving = people.filter((p) => (p.role === 'admin' || p.role === 'member') && p.weekly_email !== false && p.email);
  const noName = receiving.filter((p) => !p.full_name || p.full_name === p.email);
  const steps: [string, boolean | undefined, string][] = [
    ['Resend key', status?.resend, 'RESEND_API_KEY in Vercel'],
    ['Supabase secret key', status?.secretKey, 'SUPABASE_SECRET_KEY in Vercel'],
    ['Schedule secret', status?.cronSecret, 'CRON_SECRET in Vercel'],
    ['Sending domain verified', status?.domain, 'NOTIFY_FROM in Vercel, after verifying the domain in Resend. Until then only you get it.'],
  ];

  return (
    <section className="card text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 font-semibold">Weekly email</h2>
          <p className="text-slate-500">Every Monday morning, admins and committee members get their own list: late items, what’s due this week and the next meeting.</p>
        </div>
        {me && (me.role === 'admin' || me.role === 'member') && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-1.5 pr-3 font-semibold">
            <button role="switch" aria-checked={on} disabled={saving || !supported} onClick={toggle}
              className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-green-600' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
            {on ? 'I get it' : 'Off for me'}
          </label>
        )}
      </div>
      {err && <p className="mt-2 text-red-700">{err}</p>}
      {!supported && <p className="mt-2 text-amber-800">Needs a one-time setup: an admin runs 008_weekly_email.sql in Supabase.</p>}

      {isAdmin && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-slate-600">{receiving.length} {receiving.length === 1 ? 'person' : 'people'} will get it. Switch anyone off with the Weekly email box in the Members list.</p>
          {noName.length > 0 && (
            <p className="text-amber-800">No full name set for {noName.map((p) => p.email).join(', ')}, so their items can’t be matched. Add their names in the Members list.</p>
          )}
          {status && (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {steps.map(([label, ok, hint]) => (
                <li key={label} className="flex items-start gap-2">
                  <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? 'bg-green-600' : 'bg-amber-500'}`}>{ok ? '✓' : '!'}</span>
                  <span><span className="font-medium">{label}</span>{!ok && <span className="block text-xs text-slate-500">{hint}</span>}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setPreview((v) => !v)}>{preview ? 'Hide preview' : 'Preview my email'}</button>
            <button className="btn-ghost" onClick={sendTest} disabled={busy}>{busy ? 'Sending…' : 'Send me a test'}</button>
          </div>
          {test && <p className={test.ok ? 'text-green-700' : 'text-red-700'}>{test.ok ? `Sent to ${test.to}. Check that inbox (and spam).` : test.reason}</p>}
          {preview && <iframe src="/api/digest/test" title="Weekly email preview" className="h-[640px] w-full rounded-xl border border-slate-200 bg-white" />}
        </div>
      )}
    </section>
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
      ['Change the app design: colors, names, menu, Overview layout (after Confirm)', 'Y', 'N', 'N'],
      ['Change people, access, files or code', 'N', 'N', 'N'],
    ],
  },
  {
    area: 'Administration',
    rows: [
      ['Approve or decline access requests', 'Y', 'N', 'N'],
      ['Change anyone\'s access level', 'Y', 'N', 'N'],
      ['Test email alerts', 'Y', 'N', 'N'],
      ['Back up everything (export)', 'Y', 'N', 'N'],
      ['Change the app design on the Design page', 'Y', 'N', 'N'],
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
