'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import { useCan } from '@/components/RoleContext';
import { supabaseBrowser } from '@/lib/supabase/client';

// Every table and file, so AITCF always holds its own copy of the committee's records.
const TABLES = [
  { name: 'meetings', label: 'Meetings' },
  { name: 'action_items', label: 'Action items' },
  { name: 'decisions', label: 'Decisions' },
  { name: 'open_questions', label: 'Open questions' },
  { name: 'goals', label: 'Goals and roadmap' },
  { name: 'spotlight_artists', label: 'Spotlight roster' },
  { name: 'content_posts', label: 'Spotlight content calendar' },
  { name: 'mentors', label: 'Mentors' },
  { name: 'mentees', label: 'Mentees' },
  { name: 'mentoring_sessions', label: 'Mentoring sessions' },
  { name: 'partners', label: 'Partners' },
  { name: 'grants', label: 'Grants' },
  { name: 'provider_classes', label: 'Florida provider classes' },
  { name: 'documents', label: 'Document list' },
  { name: 'activity_log', label: 'Activity log' },
  { name: 'profiles', label: 'Team and access' },
];

export default function BackupPage() {
  const { isAdmin } = useCan();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [withFiles, setWithFiles] = useState(true);

  if (!isAdmin) {
    return <p className="card text-sm text-slate-500">Backups are available to admins only.</p>;
  }

  const note = (m: string) => setLog((l) => [...l, m]);

  async function run() {
    setBusy(true);
    setLog([]);
    const supabase = supabaseBrowser();
    const zip = new JSZip();
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    const root = zip.folder(`programs-committee-backup_${stamp}`)!;
    const manifest: Record<string, unknown> = {
      program: 'Always In The Club Foundation, Programs Committee',
      exported_at: new Date().toISOString(),
      tables: {} as Record<string, number>,
      files: { included: 0, failed: [] as string[] },
    };

    let documents: any[] = [];
    for (const t of TABLES) {
      const rows = await fetchAll(t.name);
      if (rows === null) {
        note(`⚠ Could not read ${t.label}`);
        continue;
      }
      if (t.name === 'documents') documents = rows;
      root.file(`data/${t.name}.csv`, toCsv(rows));
      root.file(`data/json/${t.name}.json`, JSON.stringify(rows, null, 2));
      (manifest.tables as Record<string, number>)[t.name] = rows.length;
      note(`✓ ${t.label}: ${rows.length} rows`);
    }

    if (withFiles) {
      const files = manifest.files as { included: number; failed: string[] };
      for (const d of documents) {
        const { data, error } = await supabase.storage.from('documents').download(d.storage_path);
        if (error || !data) {
          files.failed.push(d.name);
          note(`⚠ Could not download ${d.name}`);
          continue;
        }
        const folder = d.folder || d.category || 'unfiled';
        const prefix = d.storage_path.split('/')[0].slice(0, 8);
        root.file(`documents/${folder}/${prefix}_${d.name}`, data);
        files.included += 1;
      }
      note(`✓ Documents: ${files.included} of ${documents.length} files`);
    }

    root.file('manifest.json', JSON.stringify(manifest, null, 2));
    root.file(
      'README.txt',
      [
        'AITCF Programs Committee - Command Center backup',
        `Exported ${new Date().toLocaleString()}`,
        '',
        'data/       one CSV per table (opens in Excel or Google Sheets)',
        'data/json/  the same data in JSON, for re-importing into a database',
        'documents/  every uploaded file, grouped by category',
        'manifest.json  row and file counts, to confirm the backup is complete',
      ].join('\n'),
    );

    note('Packaging…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `programs-committee-backup_${stamp}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    note(`Done: ${(blob.size / 1024 / 1024).toFixed(1)} MB downloaded.`);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Backup</h1>
        <p className="text-sm text-slate-500">
          Download a complete copy of the program's records for AITCF: every table as a spreadsheet, plus every uploaded document.
          Run one regularly, for example after each monthly meeting.
        </p>
      </header>
      <section className="card space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={withFiles} onChange={(e) => setWithFiles(e.target.checked)} />
          Include uploaded documents
        </label>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? 'Exporting…' : 'Export everything'}
        </button>
        {log.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

async function fetchAll(table: string): Promise<any[] | null> {
  const supabase = supabaseBrowser();
  const page = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + page - 1);
    if (error) return null;
    out.push(...(data ?? []));
    if (!data || data.length < page) return out;
  }
}

function toCsv(rows: any[]): string {
  if (rows.length === 0) return '';
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // A leading BOM makes Excel read accented names correctly.
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}
