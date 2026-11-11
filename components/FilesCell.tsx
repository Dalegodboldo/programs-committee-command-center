'use client';

import { useEffect, useRef, useState } from 'react';
import { useCan, useProfile } from '@/components/RoleContext';
import { uploadDocs } from '@/lib/docs';
import DocPreview from '@/components/DocPreview';
import type { Row } from '@/lib/types';

type Docs = { rows: Row[]; insert: (v: Record<string, any>) => Promise<Row | null>; update: (id: string, p: Record<string, any>) => Promise<boolean | undefined>; setError: (m: string | null) => void };

// The 📎 cell on a record's row: shows its files and lets the team attach more.
export default function FilesCell({ docs, field, id, folder }: { docs: Docs; field: string; id: string; folder: string }) {
  const { canEdit } = useCan();
  const me = useProfile();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const files = docs.rows.filter((d) => d[field] === id);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const hide = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', hide, true);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', hide, true); };
  }, [open]);

  if (!files.length && !canEdit) return <span className="text-slate-300">—</span>;
  return (
    <div className="relative" ref={ref}>
      {preview && <DocPreview doc={preview} onClose={() => setPreview(null)} />}
      <button className={`whitespace-nowrap rounded-md px-2 py-1 text-xs ${files.length ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-400 hover:bg-slate-100'}`} onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 280), left: Math.max(8, Math.min(r.right - 288, window.innerWidth - 296)) });
        setOpen(!open);
      }}>
        📎 {files.length || '+'}
      </button>
      {open && (
        <div className="fixed z-50 w-72 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg" style={pos ?? undefined}>
          {files.length === 0 && <p className="px-1 py-1 text-slate-400">No files attached yet.</p>}
          <ul className="max-h-48 overflow-y-auto">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-slate-50">
                <button className="truncate text-left text-brand-700 hover:underline" title={f.name} onClick={() => { setPreview(f); setOpen(false); }}>{f.name}</button>
                {canEdit && (
                  <button className="shrink-0 text-xs text-slate-400 hover:text-red-600" title="Detach (the file stays in Documents)" onClick={() => docs.update(f.id, { [field]: null })}>detach</button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <label className="mt-1 block cursor-pointer rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-center text-xs text-slate-600 hover:bg-slate-50">
              {busy ? 'Uploading…' : '+ Attach a file'}
              <input type="file" multiple className="hidden" disabled={busy} onChange={async (e) => {
                const list = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (!list.length) return;
                setBusy(true);
                await uploadDocs(list, { folder, uploadedBy: me.id, link: { field, id } }, docs.insert, (m) => docs.setError(m));
                setBusy(false);
              }} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
