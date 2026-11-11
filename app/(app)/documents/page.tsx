'use client';

import { useMemo, useRef, useState } from 'react';
import ErrorBar from '@/components/ErrorBar';
import DocPreview from '@/components/DocPreview';
import { useCan, useProfile } from '@/components/RoleContext';
import { useLiveTable } from '@/lib/useLiveTable';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ACCESS_LABEL, DOC_FOLDERS, DOC_LINKS, folderLabel } from '@/lib/options';
import { fileSize, filesFromDrop, isInside, isJunk, joinPath, uploadItems } from '@/lib/docs';
import type { Row } from '@/lib/types';

const DRAG = 'application/x-pc-docs';
type Place = { folder: string; path: string };
const placeKey = (p: Place) => `${p.folder}::${p.path}`;
const fromKey = (k: string): Place => { const [folder, ...rest] = k.split('::'); return { folder, path: rest.join('::') }; };

export default function DocumentsPage() {
  const { canEdit, isAdmin } = useCan();
  const me = useProfile();
  const docs = useLiveTable('documents', { orderBy: 'created_at', ascending: false });
  const subs = useLiveTable('doc_subfolders', { orderBy: 'path' });
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
  const [path, setPath] = useState('');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const folderInput = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  const visible = (f: { access: string }) => f.access === 'everyone' || (f.access === 'team' && canEdit) || (f.access === 'admin' && isAdmin);
  const folders = DOC_FOLDERS.filter(visible).filter((f) => f.value !== 'unfiled' || docs.rows.some((d) => d.folder === 'unfiled'));
  const current = DOC_FOLDERS.find((f) => f.value === folder);
  const uploadFolder = folder === 'all' ? 'unfiled' : folder;
  const uploadPath = folder === 'all' ? '' : path;
  const canUploadHere = canEdit && (!['admin', 'screening'].includes(uploadFolder) || isAdmin);
  const sub = (d: Row) => String(d.subpath ?? '');
  const yearOf = (d: Row) => String(d.doc_year ?? String(d.created_at).slice(0, 4));
  const years = useMemo(() => [...new Set(docs.rows.map(yearOf))].sort().reverse(), [docs.rows]);

  // Every subfolder path in a top folder: the ones created on purpose plus the ones files live in (and their parents).
  const pathsIn = (f: string) => {
    const set = new Set<string>();
    const add = (p: string) => { const parts = p.split('/').filter(Boolean); for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('/')); };
    subs.rows.filter((s) => s.folder === f).forEach((s) => add(s.path));
    docs.rows.filter((d) => d.folder === f && sub(d)).forEach((d) => add(sub(d)));
    return [...set].sort((a, b) => a.localeCompare(b));
  };
  const childFolders = folder === 'all' ? [] : pathsIn(folder).filter((p) => p.startsWith(path ? path + '/' : '') && p !== path && !p.slice(path ? path.length + 1 : 0).includes('/'));
  const countIn = (f: string, p: string) => docs.rows.filter((d) => d.folder === f && isInside(sub(d), p)).length;

  const term = search.trim().toLowerCase();
  const shown = docs.rows.filter((d) =>
    (folder === 'all' || d.folder === folder) &&
    (folder === 'all' ? true : term ? isInside(sub(d), path) : sub(d) === path) &&
    (year === 'all' || yearOf(d) === year) &&
    (!term || d.name.toLowerCase().includes(term)));

  const mayChange = (d: Row) => isAdmin || canEdit;
  const linkOf = (d: Row) => {
    const l = DOC_LINKS.find((x) => d[x.field]);
    if (!l) return null;
    const rec = records[l.field].rows.find((r) => r.id === d[l.field]);
    return { ...l, name: rec ? String(rec[l.title] || 'Untitled') : 'record' };
  };

  // Places a file can be moved to: each folder this person can file into, and every subfolder in it.
  const moveFolders = DOC_FOLDERS.filter((f) => f.access !== 'admin' || isAdmin).filter((f) => f.access !== 'team' || canEdit);
  const places: (Place & { label: string })[] = moveFolders.flatMap((f) => [
    { folder: f.value, path: '', label: f.label },
    ...pathsIn(f.value).map((p) => ({ folder: f.value, path: p, label: `${f.label} / ${p.split('/').join(' / ')}` })),
  ]);
  const canDropInto = (f: string) => moveFolders.some((t) => t.value === f);

  function open(f: string, p = '') {
    setFolder(f);
    setPath(p);
    setSelected(new Set());
    setNaming(false);
  }

  async function moveTo(ids: string[], target: Place) {
    const ok = ids.map((id) => docs.rows.find((d) => d.id === id)).filter((d): d is Row => !!d && mayChange(d) && (d.folder !== target.folder || sub(d) !== target.path));
    for (const d of ok) await docs.update(d.id, { folder: target.folder, subpath: target.path });
    setSelected(new Set());
  }
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function upload(items: { file: File; dir: string }[]) {
    const list = items.filter((i) => !isJunk(i.file.name));
    if (!list.length || !canUploadHere) return;
    // Create the subfolders first so empty ones show up too.
    const dirs = [...new Set(list.map((i) => joinPath(uploadPath, i.dir)).filter(Boolean))];
    for (const p of dirs) await ensureSubfolder(uploadFolder, p);
    setProgress({ done: 0, total: list.length });
    await uploadItems(list.map((i) => ({ file: i.file, subpath: joinPath(uploadPath, i.dir) })), { folder: uploadFolder, uploadedBy: me.id },
      docs.insert, (m) => docs.setError(m), (done, total) => setProgress({ done, total }));
    setProgress(null);
  }

  async function ensureSubfolder(f: string, p: string) {
    if (subs.rows.some((s) => s.folder === f && s.path === p)) return;
    await supabaseBrowser().from('doc_subfolders').upsert({ folder: f, path: p }, { onConflict: 'folder,path', ignoreDuplicates: true });
  }

  async function createFolder() {
    const name = newName.trim().replace(/\//g, '-');
    if (!name || folder === 'all') return;
    const p = joinPath(path, name);
    if (pathsIn(folder).includes(p)) return docs.setError(`There's already a folder called "${name}" here.`);
    const { error } = await supabaseBrowser().from('doc_subfolders').insert({ folder, path: p });
    if (error) return docs.setError(error.message);
    await subs.reload();
    setNewName('');
    setNaming(false);
  }

  async function renameFolder(p: string) {
    const old = p.split('/').pop() ?? '';
    const name = window.prompt('Rename folder', old)?.trim().replace(/\//g, '-');
    if (!name || name === old) return;
    const parent = p.split('/').slice(0, -1).join('/');
    const next = joinPath(parent, name);
    if (pathsIn(folder).includes(next)) return docs.setError(`There's already a folder called "${name}" here.`);
    const { error } = await supabaseBrowser().rpc('rename_doc_subfolder', { f: folder, old_path: p, new_path: next });
    if (error) return docs.setError(error.message);
    await Promise.all([subs.reload(), docs.reload()]);
  }

  async function deleteFolder(p: string) {
    if (countIn(folder, p) > 0) return docs.setError('That folder still has files in it. Move or delete them first.');
    if (!confirm(`Delete the empty folder "${p.split('/').pop()}"?`)) return;
    const ids = subs.rows.filter((s) => s.folder === folder && isInside(s.path, p)).map((s) => s.id);
    for (const id of ids) await subs.remove(id);
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

  // Drop targets for dragged files: a sidebar folder, a breadcrumb or a subfolder tile.
  const dropProps = (target: Place) => {
    const k = placeKey(target);
    return {
      onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG) && canDropInto(target.folder)) { e.preventDefault(); e.stopPropagation(); setDropTarget(k); } },
      onDragLeave: () => setDropTarget((t) => (t === k ? null : t)),
      onDrop: (e: React.DragEvent) => { const ids = e.dataTransfer.getData(DRAG); setDropTarget(null); if (ids) { e.preventDefault(); e.stopPropagation(); moveTo(ids.split(','), target); } },
      ring: dropTarget === k,
    };
  };

  const crumbs = path ? path.split('/') : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-slate-500">Private storage, organized by folder. Make subfolders inside any folder, or upload a whole folder from your computer and its structure comes with it. Each top folder&apos;s access is enforced by the database.</p>
      </header>
      <ErrorBar error={docs.error ?? subs.error} onClose={() => { docs.setError(null); subs.setError(null); }} />

      {preview && <DocPreview doc={preview} onClose={() => setPreview(null)} />}

      {/* Phones: folders as a dropdown */}
      <select className="input md:hidden" value={folder} onChange={(e) => open(e.target.value)} aria-label="Folder">
        <option value="all">🗂️ All files ({docs.rows.length})</option>
        {folders.map((f) => <option key={f.value} value={f.value}>{f.icon} {f.label} ({docs.rows.filter((d) => d.folder === f.value).length}){f.access !== 'everyone' ? ' 🔒' : ''}</option>)}
      </select>

      <div className="grid gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="card hidden h-fit p-2 text-sm md:block">
          <FolderButton active={folder === 'all'} onClick={() => open('all')} icon="🗂️" label="All files" count={docs.rows.length} />
          <div className="my-1 border-t border-slate-100" />
          {folders.map((f) => {
            const d = dropProps({ folder: f.value, path: '' });
            return (
              <div key={f.value} onDragOver={d.onDragOver} onDragLeave={d.onDragLeave} onDrop={d.onDrop} className={`rounded-lg ${d.ring ? 'bg-brand-100 ring-2 ring-brand-500' : ''}`}>
                <FolderButton active={folder === f.value} onClick={() => open(f.value)} icon={f.icon} label={f.label}
                  count={docs.rows.filter((x) => x.folder === f.value).length} locked={f.access !== 'everyone'} />
              </div>
            );
          })}
          {canEdit && <p className="px-2 pt-2 text-[11px] leading-snug text-slate-400">Tip: drag files onto any folder or subfolder to move them.</p>}
        </nav>

        <section
          className={`card min-w-0 ${dragging ? 'ring-2 ring-brand-500' : ''}`}
          onDragOver={(e) => { if (canUploadHere && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); setDragging(false); upload(await filesFromDrop(e.dataTransfer)); }}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {current ? (
                <nav className="flex flex-wrap items-center gap-1 font-semibold" aria-label="Folder path">
                  {(() => { const d = dropProps({ folder, path: '' }); return (
                    <button onClick={() => open(folder)} onDragOver={d.onDragOver} onDragLeave={d.onDragLeave} onDrop={d.onDrop}
                      className={`rounded px-1 hover:bg-slate-100 ${d.ring ? 'bg-brand-100 ring-2 ring-brand-500' : ''} ${crumbs.length ? 'text-brand-700' : ''}`}>{current.icon} {current.label}</button>
                  ); })()}
                  {crumbs.map((c, i) => {
                    const p = crumbs.slice(0, i + 1).join('/');
                    const last = i === crumbs.length - 1;
                    const d = dropProps({ folder, path: p });
                    return (
                      <span key={p} className="flex items-center gap-1">
                        <span className="text-slate-300">/</span>
                        <button onClick={() => open(folder, p)} onDragOver={d.onDragOver} onDragLeave={d.onDragLeave} onDrop={d.onDrop}
                          className={`rounded px-1 hover:bg-slate-100 ${d.ring ? 'bg-brand-100 ring-2 ring-brand-500' : ''} ${last ? '' : 'text-brand-700'}`}>{c}</button>
                      </span>
                    );
                  })}
                </nav>
              ) : (
                <h2 className="font-semibold">🗂️ All files</h2>
              )}
              <p className="text-sm text-slate-500">{current ? current.hint : 'Every file you can see, across folders.'}</p>
              {current && <p className="mt-0.5 text-xs text-slate-400">Who can see this folder: {ACCESS_LABEL[current.access]}{path ? ' (subfolders follow the same rule)' : ''}</p>}
            </div>
            {canUploadHere && (
              <div className="flex flex-wrap gap-2">
                {folder !== 'all' && <button className="btn-ghost" onClick={() => setNaming(!naming)} disabled={busy}>+ New folder</button>}
                <label className={`btn-ghost cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                  Upload a folder
                  <input ref={folderInput} type="file" multiple className="hidden" disabled={busy}
                    {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                    onChange={(e) => {
                      const l = Array.from(e.target.files ?? []).map((file) => ({ file, dir: ((file as any).webkitRelativePath || '').split('/').slice(0, -1).join('/') }));
                      e.target.value = '';
                      upload(l);
                    }} />
                </label>
                <label className={`btn-primary cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                  {`Upload files${folder === 'all' ? ' (to Unfiled)' : ''}`}
                  <input type="file" multiple className="hidden" disabled={busy} onChange={(e) => { const l = Array.from(e.target.files ?? []).map((file) => ({ file, dir: '' })); e.target.value = ''; upload(l); }} />
                </label>
              </div>
            )}
          </div>

          {progress && (
            <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              <p className="mb-1 font-medium">Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…</p>
              <div className="h-1.5 rounded-full bg-white"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            </div>
          )}

          {naming && (
            <form className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2" onSubmit={(e) => { e.preventDefault(); createFolder(); }}>
              <span aria-hidden>📁</span>
              <input className="input !w-64" autoFocus placeholder="Folder name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} />
              <button className="btn-primary" disabled={!newName.trim()}>Create</button>
              <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => { setNaming(false); setNewName(''); }}>Cancel</button>
            </form>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input !w-64" placeholder={folder === 'all' ? 'Search file names…' : 'Search this folder and its subfolders…'} value={search} onChange={(e) => setSearch(e.target.value)} />
            {(years.length > 1 || year !== 'all') && (
              <select className="input !w-32" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">Any year</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {canUploadHere && <span className="self-center text-xs text-slate-400">Or drag files or whole folders here. Up to 50 MB each.</span>}
          </div>

          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <span className="font-medium text-brand-700">{selected.size} selected</span>
              <select className="input !w-72" value="" onChange={(e) => e.target.value && moveTo([...selected], fromKey(e.target.value))}>
                <option value="">Move to folder…</option>
                {places.map((p) => <option key={placeKey(p)} value={placeKey(p)}>{p.label}</option>)}
              </select>
              <button className="text-xs text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}

          {!term && childFolders.length > 0 && (
            <ul className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {childFolders.map((p) => {
                const d = dropProps({ folder, path: p });
                const n = countIn(folder, p);
                return (
                  <li key={p} onDragOver={d.onDragOver} onDragLeave={d.onDragLeave} onDrop={d.onDrop}
                    className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${d.ring ? 'border-brand-500 bg-brand-100 ring-2 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => open(folder, p)}>
                      <span aria-hidden>📁</span>
                      <span className="truncate font-medium">{p.split('/').pop()}</span>
                      <span className="text-xs text-slate-400">{n}</span>
                    </button>
                    {canEdit && (
                      <span className="flex shrink-0 gap-1 opacity-60 group-hover:opacity-100">
                        <button className="rounded px-1 text-xs text-slate-500 hover:bg-white" title="Rename" onClick={() => renameFolder(p)}>Rename</button>
                        {n === 0 && <button className="rounded px-1 text-xs text-red-600 hover:bg-white" title="Delete empty folder" onClick={() => deleteFolder(p)}>Delete</button>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {term ? 'No files match.' : childFolders.length ? 'No files at this level. Open a folder above, or upload here.' : path ? 'This folder is empty.' : docs.rows.length ? 'No files here yet.' : 'No documents yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((d) => <DocRow key={d.id} d={d} where={folder === 'all' ? [folderLabel(d.folder), ...sub(d).split('/').filter(Boolean)].join(' / ') : term && sub(d) !== path ? sub(d).slice(path ? path.length + 1 : 0) : ''}
                link={linkOf(d)} canChange={mayChange(d)}
                selected={selected.has(d.id)} onSelect={() => toggle(d.id)}
                onDragStart={(e) => {
                  const ids = selected.has(d.id) ? [...selected] : [d.id];
                  e.dataTransfer.setData(DRAG, ids.join(','));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                places={places}
                records={records} onOpen={() => setPreview(d)} onMove={(k) => moveTo([d.id], fromKey(k))}
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

function DocRow({ d, where, link, canChange, selected, onSelect, onDragStart, places, records, onOpen, onMove, onYear, onLink, onDelete }: {
  d: Row; where: string; link: { label: string; name: string } | null; canChange: boolean;
  selected: boolean; onSelect: () => void; onDragStart: (e: React.DragEvent) => void;
  places: (Place & { label: string })[]; records: Record<string, { rows: Row[] }>;
  onOpen: () => void; onMove: (key: string) => void; onYear: (y: number) => void; onLink: (field: string, id: string | null) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const here = placeKey({ folder: d.folder, path: String(d.subpath ?? '') });
  const moveSelect = (cls: string) => (
    <select className={`input text-xs ${cls}`} value={here} title="Move to folder" onChange={(e) => onMove(e.target.value)}>
      {!places.some((p) => placeKey(p) === here) && <option value={here}>{folderLabel(d.folder)}</option>}
      {places.map((p) => <option key={placeKey(p)} value={placeKey(p)}>{p.label}</option>)}
    </select>
  );
  return (
    <li className={`py-2.5 text-sm ${canChange ? 'cursor-grab active:cursor-grabbing' : ''} ${selected ? 'bg-brand-50/60' : ''}`} draggable={canChange} onDragStart={canChange ? onDragStart : undefined}>
      <div className="flex items-start gap-3">
        {canChange && <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={selected} onChange={onSelect} aria-label={`Select ${d.name}`} />}
        <span className="mt-0.5 text-lg leading-none" aria-hidden>{/\.pdf$/i.test(d.name) ? '📕' : /\.(png|jpe?g|gif|webp|heic)$/i.test(d.name) ? '🖼️' : /\.(xlsx?|csv)$/i.test(d.name) ? '📊' : /\.(docx?|txt|rtf)$/i.test(d.name) ? '📝' : '📄'}</span>
        <div className="min-w-0 flex-1">
          <button className="max-w-full truncate text-left font-medium text-brand-700 hover:underline" title={d.name} onClick={onOpen}>{d.name}</button>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {where && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">📁 {where}</span>}
            {link && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">📎 {link.label}: {link.name}</span>}
            <span className="font-medium text-slate-600">{d.doc_year ?? String(d.created_at).slice(0, 4)}</span>
            <span>· {fileSize(d.size_bytes)}</span>
            <span>· added {new Date(d.created_at).toLocaleDateString()}</span>
          </p>
        </div>
        {canChange && (
          <span className="flex shrink-0 items-center gap-1">
            {moveSelect('hidden !w-52 md:block')}
            <button className="btn-ghost text-xs" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'More'}</button>
          </span>
        )}
      </div>
      {editing && (
        <div className="ml-8 mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <label className="flex items-center gap-1 text-xs text-slate-500 md:hidden">Folder {moveSelect('!w-56')}</label>
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
