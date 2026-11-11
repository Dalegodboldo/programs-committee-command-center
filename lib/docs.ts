'use client';

import { supabaseBrowser } from './supabase/client';
import type { Row } from './types';

const BUCKET = 'documents';

// Uploads files into a folder (optionally into a subfolder, or attached to a record) and lets Ask Claude index them.
export async function uploadDocs(
  files: File[],
  opts: { folder: string; uploadedBy: string; subpath?: string; link?: { field: string; id: string } },
  insert: (values: Record<string, any>) => Promise<Row | null>,
  onError: (msg: string) => void,
) {
  return uploadItems(files.map((file) => ({ file, subpath: opts.subpath ?? '' })), opts, insert, onError);
}

// Same, for a mixed list where each file carries its own subfolder (used for folder uploads).
export async function uploadItems(
  items: { file: File; subpath: string }[],
  opts: { folder: string; uploadedBy: string; link?: { field: string; id: string } },
  insert: (values: Record<string, any>) => Promise<Row | null>,
  onError: (msg: string) => void,
  onProgress?: (done: number, total: number) => void,
) {
  const supabase = supabaseBrowser();
  let done = 0;
  for (const { file, subpath } of items) {
    onProgress?.(done, items.length);
    const safe = file.name.replace(/[^\w.\- ]+/g, '_');
    const path = `${crypto.randomUUID()}/${safe}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
    done++;
    if (up.error) { onError(`${file.name}: ${up.error.message}`); continue; }
    const row = await insert({
      name: file.name, folder: opts.folder, subpath, storage_path: path, size_bytes: file.size, uploaded_by: opts.uploadedBy,
      ...(opts.link ? { [opts.link.field]: opts.link.id } : {}),
    });
    if (!row) { await supabase.storage.from(BUCKET).remove([path]); continue; }
    fetch('/api/assistant/index-document', { method: 'POST', body: JSON.stringify({ id: row.id }) }).catch(() => {});
  }
  onProgress?.(done, items.length);
}

// Folder paths: "Meeting 1/Agendas". Empty string is the top of a folder.
export const joinPath = (...parts: string[]) => parts.flatMap((p) => p.split('/')).map((s) => s.trim()).filter(Boolean).join('/');
export const isInside = (subpath: string, path: string) => !path || subpath === path || subpath.startsWith(path + '/');
const JUNK = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
export const isJunk = (name: string) => JUNK.has(name) || name.startsWith('._');

// Reads files dropped from the desktop, walking into dropped folders and keeping their structure.
export async function filesFromDrop(dt: DataTransfer): Promise<{ file: File; dir: string }[]> {
  const entries = Array.from(dt.items ?? []).map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return Array.from(dt.files).map((file) => ({ file, dir: '' }));
  const out: { file: File; dir: string }[] = [];
  async function walk(entry: any, dir: string) {
    if (entry.isFile) {
      const file: File = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, dir });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const next = joinPath(dir, entry.name);
      for (;;) {
        const batch: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, next);
      }
    }
  }
  for (const e of entries) await walk(e, '');
  return out;
}

export async function openDoc(doc: Row, onError: (msg: string) => void) {
  // Open the tab first (so pop-up blockers allow it), then point it at the short-lived link.
  const win = window.open('', '_blank');
  const { data, error } = await supabaseBrowser().storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
  if (error || !data) { win?.close(); return onError(error?.message ?? 'Could not open the file.'); }
  if (win) win.location.href = data.signedUrl; else window.open(data.signedUrl, '_blank', 'noopener');
}

export function fileSize(b?: number | null) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
