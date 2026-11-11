'use client';

import { supabaseBrowser } from './supabase/client';
import type { Row } from './types';

const BUCKET = 'documents';

// Uploads files into a folder (optionally attached to a record) and lets Ask Claude index them.
export async function uploadDocs(
  files: File[],
  opts: { folder: string; uploadedBy: string; link?: { field: string; id: string } },
  insert: (values: Record<string, any>) => Promise<Row | null>,
  onError: (msg: string) => void,
) {
  const supabase = supabaseBrowser();
  for (const file of files) {
    const safe = file.name.replace(/[^\w.\- ]+/g, '_');
    const path = `${crypto.randomUUID()}/${safe}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (up.error) { onError(`${file.name}: ${up.error.message}`); continue; }
    const row = await insert({
      name: file.name, folder: opts.folder, storage_path: path, size_bytes: file.size, uploaded_by: opts.uploadedBy,
      ...(opts.link ? { [opts.link.field]: opts.link.id } : {}),
    });
    if (!row) { await supabase.storage.from(BUCKET).remove([path]); continue; }
    fetch('/api/assistant/index-document', { method: 'POST', body: JSON.stringify({ id: row.id }) }).catch(() => {});
  }
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
