'use client';

import { useMemo, useState } from 'react';
import ErrorBar from '@/components/ErrorBar';
import DocPreview from '@/components/DocPreview';
import { useCan, useProfile } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ACCESS_LABEL, DOC_FOLDERS, DOC_LINKS, folderLabel } from '@/lib/options';
import { fileSize, uploadDocs } from '@/lib/docs';
import type { Row } from '@/lib/types';

export default function DocumentsPage() {
  const { canEdit, isAdmin } = useCan();
  const me = useProfile();
  const docs = useLiveTable('documents', { orderBy: 'created_at', ascending: false });
  const records = {
    meeting_id: useLiveTable('meetings', { orderBy: 'meeting_date', ascending: false }),
    partner_id: useLiveTable('partners', { orderBy: 'name' }),
    grant_id: useLiveTable('grants', { orderBy: 'funder' }),
    class_id: useLiveTable('provider_classes', { orderBy: 'title' }),
    artist_id: useLiveTable('spotlight_artists', { orderBy: 'name' }),
    mentee_id: useLiveTable('mentees', { orderBy: 'name' }),
    mentor_id: useLiveTable('mentors', { orderBy: 'name' }),
  } as Record<string, ReturnType<typeof useLiveTable>>;
  const [folder, setFolder] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);

  const folders = DOC_FOLDERS.filter((f) => f.access === 'everyone' || (f.access === 'team' && canEdit) || (f.access === 'admin' && isAdmin))
    .filter((f) => f.value !== 'unfiled' || docs.rows.some((d) => d.folder === 'unfiled'));
  const current = DOC_FOLDERS.find((f) => f.value === folder);
  const uploadFolder = folder === 'all' ? 'unfiled' : folder;
  const canUploadHere = canEdit && (!['admin', 'screening'].includes(uploadFolder) || isAdmin);
  const yearOf = (d: Row) => String(d.doc_year ?? String(d.created_at).slice(0, 4));
  const years = useMemo(() => [...new Set(docs.rows.map(yearOf))].sort().reverse(), [docs.rows]);

  const shown = docs.rows.filter((d) =>
    (folder === 'all' || d.folder === folder) &&
    (year === 'all' || yearOf(d) === year) &&
    (!search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase())));

  const mayChange = (d: Row) => isAdmin || canEdit;
  const linkOf = (d: Row) => {
    const l = DOC_LINKS.find((x) => d[x.field]);
    if (!l) return null;
    const rec = records[l.field].rows.find((r) => r.id === d[l.field]);
    return { ...l, name: rec ? String(rec[l.title] || 'Untitled') : 'record' };
  };

  const moveTargets = DOC_FOLDERS.filter((f) => f.access !== 'admin' || isAdmin).filter((f) => f.access !== 'team' || canEdit);
  const canDropInto = (f: string) => moveTargets.some((t) => t.value === f);

  // Move one or more files to a folder (only files this person may change).
  async function moveTo(ids: string[], target: string) {
    const ok = ids.map((id) => docs.rows.find((d) => d.id === id)).filter((d): d is Row => !!d && mayChange(d) && d.folder !== target);
    for (const d of ok) await docs.update(d.id, { folder: target });
    setSelected(new Set());
  }
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function upload(list: File[]) {
    if (!list.length || !canUploadHere) return;
    setBusy(true);
    await uploadDocs(list, { folder: uploadFolder, uploadedBy: me.id }, docs.insert, (m) => docs.setError(m));
    setBusy(false);
  }

  async function del(d: Row) {
    if (!isAdmin && d.uploaded_by !== me.id) return docs.setError('Only the person who uploaded this file, or an admin, can delete it.');
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    const { error } = await supabaseBrowser().storage.from('documents').remove([d.storage_path]);
    if (error) return docs.setError(error.message);
    await docs.remove(d.id);
  }

  async function setLink(d: Row, field: string, id: string | null) {
    const clear = Object.fromEntries(DOC_LINKS.map((l) => [l.field, null]));
    await docs.update(d.id, id ? { ...clear, [field]: id } : clear);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-slate-500">Private storage, organized by folder. Each folder&apos;s access is enforced by the database; files open through a link that expires after one minute.</p>
      </header>
      <ErrorBar error={docs.error} onClose={() => docs.setError(null)} />

      {preview && <DocPreview doc={preview} onClose={() => setPreview(null)} />}

      {/* Phones: folders as a dropdown */}
      <select className="input md:hidden" value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Folder">
        <option value="all">🗂️ All files ({docs.rows.length})</option>
        {folders.map((f) => <option key={f.value} value={f.value}>{f.icon} {f.label} ({docs.rows.filter((d) => d.folder === f.value).length}){f.access !== 'everyone' ? ' 🔒' : ''}</option>)}
      </select>

      <div className="grid gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="card hidden h-fit p-2 text-sm md:block">
          <FolderButton active={folder === 'all'} onClick={() => setFolder('all')} icon="🗂️" label="All files" count={docs.rows.length} />
          <div className="my-1 border-t border-slate-100" />
          {folders.map((f) => (
            <div key={f.value}
              onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-pc-docs') && canDropInto(f.value)) { e.preventDefault(); setDropTarget(f.value); } }}
              onDragLeave={() => setDropTarget((t) => (t === f.value ? null : t))}
              onDrop={(e) => { const ids = e.dataTransfer.getData('application/x-pc-docs'); setDropTarget(null); if (ids) { e.preventDefault(); moveTo(ids.split(','), f.value); } }}
              className={`rounded-lg ${dropTarget === f.value ? 'bg-brand-100 ring-2 ring-brand-500' : ''}`}>
              <FolderButton active={folder === f.value} onClick={() => setFolder(f.value)} icon={f.icon} label={f.label}
                count={docs.rows.filter((d) => d.folder === f.value).length} locked={f.access !== 'everyone'} />
            </div>
          ))}
          {canEdit && <p className="px-2 pt-2 text-[11px] leading-snug text-slate-400">Tip: drag files onto a folder to move them.</p>}
        </nav>

        <section
          className={`card min-w-0 ${dragging ? 'ring-2 ring-brand-500' : ''}`}
          onDragOver={(e) => { if (canUploadHere && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); setDragging(false); upload(Array.from(e.dataTransfer.files)); }}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{current ? `${current.icon} ${current.label}` : '🗂️ All files'}</h2>
              <p className="text-sm text-slate-500">{current ? current.hint : 'Every file you can see, across folders.'}</p>
              {current && <p className="mt-0.5 text-xs text-slate-400">Who can see this folder: {ACCESS_LABEL[current.access]}</p>}
            </div>
            {canUploadHere && (
              <label className="btn-primary cursor-pointer">
                {busy ? 'Uploading…' : `Upload${folder === 'all' ? ' (to Unfiled)' : ''}`}
                <input type="file" multiple className="hidden" disabled={busy} onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; upload(l); }} />
              </label>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input !w-64" placeholder="Search file names…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {/* Only worth showing once files span more than one year. */}
            {(years.length > 1 || year !== 'all') && (
              <select className="input !w-32" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">Any year</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {canUploadHere && <span className="self-center text-xs text-slate-400">Or drag files here. Up to 50 MB each.</span>}
          </div>

          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <span className="font-medium text-brand-700">{selected.size} selected</span>
              <select className="input !w-52" value="" onChange={(e) => e.target.value && moveTo([...selected], e.target.value)}>
                <option value="">Move to folder…</option>
                {moveTargets.map((f) => <option key={f.value} value={f.value}>{f.icon} {f.label}</option>)}
              </select>
              <button className="text-xs text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">{docs.rows.length ? 'No files match.' : 'No documents yet.'}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((d) => <DocRow key={d.id} d={d} showFolder={folder === 'all'} link={linkOf(d)} canChange={mayChange(d)}
                selected={selected.has(d.id)} onSelect={() => toggle(d.id)}
                onDragStart={(e) => {
                  const ids = selected.has(d.id) ? [...selected] : [d.id];
                  e.dataTransfer.setData('application/x-pc-docs', ids.join(','));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                folders={moveTargets}
                records={records} onOpen={() => setPreview(d)} onMove={(f) => docs.update(d.id, { folder: f })}
                onYear={(y) => docs.update(d.id, { doc_year: y })}
                onLink={(field, id) => setLink(d, field, id)} onDelete={() => del(d)} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function FolderButton({ active, onClick, icon, label, count, locked }: { active: boolean; onClick: () => void; icon: string; label: string; count: number; locked?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${active ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
      <span aria-hidden>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {locked && <span className="text-[10px] text-slate-400" title="Limited access">🔒</span>}
      <span className="text-xs text-slate-400">{count}</span>
    </button>
  );
}

function LinkPicker({ doc, records, onChange }: { doc: Row; records: Record<string, { rows: Row[] }>; onChange: (field: string, id: string | null) => void }) {
  const currentField = DOC_LINKS.find((l) => doc[l.field])?.field ?? '';
  const [field, setField] = useState<string>(currentField);
  const spec = DOC_LINKS.find((l) => l.field === field);
  const label = (r: Row) => {
    const t = String(r[spec!.title] || 'Untitled');
    const when = (spec!.date && r[spec!.date]) || '';
    return when ? `${t} (${when})` : t;
  };
  return (
    <span className="flex items-center gap-1">
      <select className="input !w-28 text-xs" value={field} title="Attach to a record" onChange={(e) => { setField(e.target.value); if (!e.target.value) onChange('', null); }}>
        <option value="">Attach to…</option>
        {DOC_LINKS.filter((l) => records[l.field].rows.length > 0).map((l) => <option key={l.field} value={l.field}>{l.label}</option>)}
      </select>
      {spec && (
        <select className="input !w-44 text-xs" value={doc[spec.field] ?? ''} onChange={(e) => onChange(spec.field, e.target.value || null)}>
          <option value="">Choose…</option>
          {records[spec.field].rows.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
        </select>
      )}
    </span>
  );
}

function DocRow({ d, showFolder, link, canChange, selected, onSelect, onDragStart, folders, records, onOpen, onMove, onYear, onLink, onDelete }: {
  d: Row; showFolder: boolean; link: { label: string; name: string } | null; canChange: boolean;
  selected: boolean; onSelect: () => void; onDragStart: (e: React.DragEvent) => void;
  folders: readonly { value: string; label: string }[]; records: Record<string, { rows: Row[] }>;
  onOpen: () => void; onMove: (folder: string) => void; onYear: (y: number) => void; onLink: (field: string, id: string | null) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={`py-2.5 text-sm ${canChange ? 'cursor-grab active:cursor-grabbing' : ''} ${selected ? 'bg-brand-50/60' : ''}`} draggable={canChange} onDragStart={canChange ? onDragStart : undefined}>
      <div className="flex items-start gap-3">
        {canChange && <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={selected} onChange={onSelect} aria-label={`Select ${d.name}`} />}
        <span className="mt-0.5 text-lg leading-none" aria-hidden>{/\.pdf$/i.test(d.name) ? '📕' : /\.(png|jpe?g|gif|webp|heic)$/i.test(d.name) ? '🖼️' : /\.(xlsx?|csv)$/i.test(d.name) ? '📊' : /\.(docx?|txt|rtf)$/i.test(d.name) ? '📝' : '📄'}</span>
        <div className="min-w-0 flex-1">
          <button className="max-w-full truncate text-left font-medium text-brand-700 hover:underline" title={d.name} onClick={onOpen}>{d.name}</button>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {showFolder && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{folderLabel(d.folder)}</span>}
            {link && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">📎 {link.label}: {link.name}</span>}
            <span className="font-medium text-slate-600">{d.doc_year ?? String(d.created_at).slice(0, 4)}</span>
            <span>· {fileSize(d.size_bytes)}</span>
            <span>· added {new Date(d.created_at).toLocaleDateString()}</span>
          </p>
        </div>
        {canChange && (
          <span className="flex shrink-0 items-center gap-1">
            <select className="input hidden !w-44 text-xs md:block" value={d.folder} title="Move to folder" onChange={(e) => onMove(e.target.value)}>
              {folders.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button className="btn-ghost text-xs" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'More'}</button>
          </span>
        )}
      </div>
      {editing && (
        <div className="ml-8 mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <label className="flex items-center gap-1 text-xs text-slate-500 md:hidden">Folder
            <select className="input !w-44 text-xs" value={d.folder} onChange={(e) => onMove(e.target.value)}>
              {folders.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500" title="The year this document belongs to">Year
            <input className="input !w-20 text-xs" type="number" min={2000} max={2100} defaultValue={d.doc_year ?? Number(String(d.created_at).slice(0, 4))}
              onBlur={(e) => { const y = Number(e.target.value); if (y >= 2000 && y <= 2100 && y !== d.doc_year) onYear(y); }} />
          </label>
          <LinkPicker doc={d} records={records} onChange={onLink} />
          <button className="btn-danger ml-auto text-xs" onClick={onDelete}>Delete file</button>
        </div>
      )}
    </li>
  );
}
