'use client';

import { useState } from 'react';
import EditableTable, { type Column } from '@/components/EditableTable';
import ErrorBar from '@/components/ErrorBar';
import FilesCell from '@/components/FilesCell';
import Tabs, { Pill } from '@/components/Tabs';
import { useCan } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import { AGE_STATUS, DISCIPLINE, OUTREACH_STATUS, POST_FORMAT, POST_STATUS } from '@/lib/options';
import { addDays, shortDate, today } from '@/lib/dates';
import type { Row } from '@/lib/types';

type Tab = 'roster' | 'calendar';

export default function SpotlightPage() {
  const { canEdit } = useCan();
  const [tab, setTab] = useState<Tab>('roster');
  const artists = useLiveTable('spotlight_artists', { orderBy: 'name' });
  const posts = useLiveTable('content_posts', { orderBy: 'post_date' });

  if (!canEdit) {
    return <div className="card text-sm text-slate-600">The Spotlight roster holds family contact details, so it&apos;s open to admins and committee members only.</div>;
  }

  const counts = OUTREACH_STATUS.map((s) => ({ ...s, n: artists.rows.filter((a) => a.outreach_status === s.value).length }));
  const signed = artists.rows.filter((a) => a.outreach_status === 'release_signed' || a.outreach_status === 'featured').length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Spotlight</h1>
        <p className="text-sm text-slate-500">Discover, spotlight, mentor, showcase. Full names stay here; public posts use first names only, and only after the guardian signs the release.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Mini label="On the roster" value={artists.rows.length} />
        <Mini label="Guardians messaged" value={artists.rows.filter((a) => ['messaged', 'release_sent', 'release_signed', 'featured'].includes(a.outreach_status)).length} />
        <Mini label="Releases signed" value={signed} highlight />
        <Mini label="Featured" value={artists.rows.filter((a) => a.outreach_status === 'featured').length} />
        <Mini label="Offered mentoring" value={artists.rows.filter((a) => a.mentoring_offered).length} />
        <Mini label="Posts scheduled" value={posts.rows.filter((p) => p.status === 'scheduled' || p.status === 'approved').length} />
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Outreach pipeline</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {counts.map((c) => (
            <div key={c.value} className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-xl font-semibold">{c.n}</p>
              <p className="text-[11px] leading-tight text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>
      </section>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ key: 'roster', label: 'Roster', count: artists.rows.length }, { key: 'calendar', label: 'Content calendar', count: posts.rows.length }]} />
      <section className="card">
        {tab === 'roster' ? <Roster t={artists} /> : <Calendar t={posts} artists={artists.rows} />}
      </section>
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`card p-3 ${highlight ? 'border-gold-400 bg-gold-50' : ''}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Roster({ t }: { t: ReturnType<typeof useLiveTable> }) {
  const { canEdit } = useCan();
  const docs = useLiveTable('documents');
  const [disc, setDisc] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const rows = t.rows.filter((a) => (disc === 'all' || a.discipline === disc) && (status === 'all' || a.outreach_status === status) &&
    (!q.trim() || `${a.name} ${a.handle ?? ''} ${a.notes ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const cols: Column[] = [
    { key: 'name', label: 'Artist (internal)', width: '170px' },
    { key: 'discipline', label: 'Discipline', type: 'select', options: [{ value: '', label: '—' }, ...DISCIPLINE], width: '170px' },
    { key: 'handle', label: 'Handle', width: '170px' },
    { key: 'age_status', label: 'Age', type: 'select', options: AGE_STATUS, width: '110px' },
    { key: 'outreach_status', label: 'Outreach', type: 'select', options: OUTREACH_STATUS, width: '160px' },
    { key: 'guardian_name', label: 'Guardian or manager', width: '160px' },
    { key: 'guardian_contact', label: 'Guardian contact', width: '180px' },
    { key: 'release_signed_on', label: 'Release signed', type: 'date', width: '140px' },
    { key: 'featured_on', label: 'Featured', type: 'date', width: '140px' },
    { key: 'mentoring_offered', label: 'Mentoring offered', type: 'checkbox' },
    { key: 'showcase_invite', label: 'Showcase invite', type: 'checkbox' },
    { key: 'notes', label: 'Notes', type: 'textarea', width: '200px' },
    { key: '_files', label: 'Release', type: 'computed', render: (r) => <FilesCell docs={docs} field="artist_id" id={r.id} folder="releases" /> },
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-56" placeholder="Search names, handles, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-48" value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Discipline">
          <option value="all">Any discipline</option>
          {DISCIPLINE.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select className="input !w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Outreach status">
          <option value="all">Any status</option>
          {OUTREACH_STATUS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {canEdit && <button className="btn-ghost ml-auto" onClick={() => setImporting(!importing)}>{importing ? 'Close import' : 'Import from CSV'}</button>}
      </div>
      {importing && <CsvImport onImport={async (list) => { for (const r of list) await t.insert(r); setImporting(false); }} existing={t.rows} />}
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ name: 'New artist', discipline: disc === 'all' ? null : disc })} addLabel="Add artist"
        empty="No artists yet. Import the roster from a CSV, or add them one at a time." />
    </>
  );
}

// Paste or upload a CSV with a header row. Recognized columns: name, discipline, handle, notes, age (minor/adult).
function CsvImport({ onImport, existing }: { onImport: (rows: Record<string, any>[]) => Promise<void>; existing: Row[] }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = parseCsv(text);
  const header = (parsed[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iName = col(['name', 'artist']), iDisc = col(['discipline', 'group', 'role']), iHandle = col(['handle', 'instagram']), iNotes = col(['notes', 'note']), iAge = col(['age', 'age_status']);
  const known = new Set(existing.map((r) => String(r.handle ?? '').toLowerCase()).filter(Boolean));
  const discs = DISCIPLINE.map((d) => d.value);
  const rows = iName < 0 ? [] : parsed.slice(1).filter((r) => r[iName]?.trim()).map((r) => {
    const d = iDisc >= 0 ? r[iDisc]?.trim() : '';
    const age = iAge >= 0 ? r[iAge]?.trim().toLowerCase() : '';
    return {
      name: r[iName].trim(),
      discipline: discs.find((x) => x.toLowerCase() === d?.toLowerCase()) ?? (d ? 'Other' : null),
      handle: iHandle >= 0 ? r[iHandle]?.trim() || null : null,
      age_status: age === 'minor' || age === 'adult' ? age : 'unknown',
      notes: [iNotes >= 0 ? r[iNotes]?.trim() : '', d && !discs.some((x) => x.toLowerCase() === d.toLowerCase()) ? `Listed as: ${d}` : ''].filter(Boolean).join(' · ') || null,
    };
  });
  const fresh = rows.filter((r) => !r.handle || !known.has(r.handle.toLowerCase()));
  return (
    <div className="mb-4 space-y-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm">
      <p className="text-slate-600">Paste a CSV with a header row, or choose a file. Columns used: <b>name</b>, discipline, handle, age (minor or adult), notes. Rows whose handle is already on the roster are skipped.</p>
      <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      <textarea className="input font-mono text-xs" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="name,discipline,handle,notes" />
      {text && iName < 0 && <p className="text-red-700">No &quot;name&quot; column found in the first row.</p>}
      {rows.length > 0 && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy || fresh.length === 0} onClick={async () => { setBusy(true); await onImport(fresh); setBusy(false); setText(''); }}>
            {busy ? 'Importing…' : `Import ${fresh.length} artist${fresh.length === 1 ? '' : 's'}`}
          </button>
          {rows.length > fresh.length && <span className="text-slate-500">{rows.length - fresh.length} already on the roster</span>}
        </div>
      )}
    </div>
  );
}

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); out.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim()));
}

function Calendar({ t, artists }: { t: ReturnType<typeof useLiveTable>; artists: Row[] }) {
  const { canEdit } = useCan();
  const [showPosted, setShowPosted] = useState(false);
  const releaseOk = (id?: string) => {
    const a = artists.find((x) => x.id === id);
    return !!a && (a.outreach_status === 'release_signed' || a.outreach_status === 'featured' || !!a.release_signed_on);
  };
  const rows = t.rows.filter((p) => showPosted || p.status !== 'posted');
  const cols: Column[] = [
    { key: 'post_date', label: 'Date', type: 'date', width: '140px' },
    { key: 'format', label: 'Format', type: 'select', options: POST_FORMAT, width: '180px' },
    { key: 'artist_id', label: 'Artist', type: 'select', options: [{ value: '', label: '—' }, ...artists.map((a) => ({ value: a.id, label: `${a.name}${a.discipline ? ` (${a.discipline})` : ''}` }))], width: '200px' },
    { key: '_release', label: 'Release', type: 'computed', render: (r) => !r.artist_id ? <span className="text-slate-300">—</span> : releaseOk(r.artist_id) ? <Pill tone="green">Signed</Pill> : <Pill tone="red">Not signed</Pill> },
    { key: 'status', label: 'Status', type: 'select', options: POST_STATUS, width: '120px' },
    { key: 'caption', label: 'Caption', type: 'textarea', width: '260px' },
    { key: 'channels', label: 'Channels', width: '170px' },
    { key: 'link', label: 'Link', width: '150px' },
  ];

  // Adds next week's Monday, Wednesday and Friday posts.
  async function addWeek() {
    const t0 = today();
    const d = new Date(t0 + 'T12:00:00');
    const toMonday = ((8 - d.getDay()) % 7) || 7;
    const mon = addDays(t0, toMonday);
    for (const [offset, format] of [[0, 'spotlight'], [2, 'mentor_moment'], [4, 'open_call']] as const) {
      await t.insert({ post_date: addDays(mon, offset), format, status: 'idea' });
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <p className="text-slate-500">Three posts a week. An artist can only be posted once their guardian&apos;s release is signed.</p>
        <label className="ml-auto flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={showPosted} onChange={(e) => setShowPosted(e.target.checked)} /> Show posted</label>
        {canEdit && <button className="btn-ghost" onClick={addWeek}>+ Add next week&apos;s three posts</button>}
      </div>
      <ErrorBar error={t.error} onClose={() => t.setError(null)} />
      <EditableTable rows={rows} columns={cols} canEdit={canEdit} onUpdate={t.update} onDelete={t.remove}
        onAdd={() => t.insert({ post_date: addDays(today(), 1), format: 'spotlight', status: 'idea' })} addLabel="Add post"
        empty={`No posts planned yet. Next Monday is ${shortDate(addDays(today(), ((8 - new Date().getDay()) % 7) || 7))}.`} />
      <p className="mt-3 text-xs text-slate-500">Caption template: “Spotlight: [First name], [discipline]. [One line on what stands out.] Shared with permission from [their family / their team]. Know a young artist we should see? Tag them below. #AITCFSpotlight #AlwaysInTheClub”</p>
      <p className="mt-1 text-xs text-slate-500">Minors are contacted only through a parent, guardian or manager.</p>
    </>
  );
}
