'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fileSize } from '@/lib/docs';
import { folderLabel } from '@/lib/options';
import type { Row } from '@/lib/types';

const kindOf = (name: string) => {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'md', 'csv', 'json'].includes(ext)) return 'text';
  if (['mp4', 'mov', 'm4v', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'm4a', 'wav'].includes(ext)) return 'audio';
  return 'other';
};

// Full-screen on phones, a large window on computers. Links last 10 minutes.
export default function DocPreview({ doc, onClose }: { doc: Row; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = kindOf(doc.name);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const storage = supabaseBrowser().storage.from('documents');
    storage.createSignedUrl(doc.storage_path, 600).then(({ data, error }: { data: { signedUrl: string } | null; error: { message: string } | null }) => {
      if (error || !data) return setError(error?.message ?? 'Could not open this file.');
      setUrl(data.signedUrl);
      if (kind === 'text') fetch(data.signedUrl).then((r) => r.text()).then((t) => setText(t.slice(0, 200_000))).catch(() => {});
    });
    storage.createSignedUrl(doc.storage_path, 600, { download: doc.name }).then(({ data }: { data: { signedUrl: string } | null }) => setDownloadUrl(data?.signedUrl ?? null));
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [doc.storage_path, doc.name, kind]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-900/70 md:items-center md:p-6" onClick={onClose}>
      <div className="flex w-full flex-col bg-white md:h-[90vh] md:max-w-5xl md:rounded-xl md:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold" title={doc.name}>{doc.name}</p>
            <p className="text-xs text-slate-500">{[folderLabel(doc.folder), doc.doc_year, fileSize(doc.size_bytes)].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="btn-ghost shrink-0" onClick={onClose} aria-label="Close preview">✕ Close</button>
        </div>

        <div className="relative flex-1 overflow-auto bg-slate-100">
          {error && <p className="p-6 text-sm text-red-700">{error}</p>}
          {!url && !error && <p className="p-6 text-sm text-slate-400">Loading…</p>}
          {url && kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={doc.name} className="mx-auto max-h-full max-w-full object-contain p-2" />
          )}
          {url && kind === 'pdf' && (
            <>
              {/* Computers show the PDF here; phones open their own PDF viewer, which handles every page and zoom. */}
              <iframe src={url} title={doc.name} className="hidden h-full w-full md:block" />
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center md:hidden">
                <span className="text-5xl">📕</span>
                <p className="text-sm text-slate-600">Opens in your phone&apos;s PDF viewer, where you can scroll every page and zoom.</p>
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary px-6 py-3 text-base">View PDF</a>
              </div>
            </>
          )}
          {url && kind === 'video' && <video src={url} controls playsInline className="mx-auto max-h-full max-w-full" />}
          {url && kind === 'audio' && <div className="p-6"><audio src={url} controls className="w-full" /></div>}
          {url && kind === 'text' && <pre className="whitespace-pre-wrap break-words p-4 text-xs text-slate-800">{text ?? 'Loading…'}</pre>}
          {url && kind === 'other' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="text-5xl">📄</span>
              <p className="max-w-sm text-sm text-slate-600">This kind of file (Word, Excel, PowerPoint…) opens in your device&apos;s viewer. iPhones and iPads preview it right away.</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary px-6 py-3 text-base">Open file</a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          {kind === 'pdf' && <span className="mr-auto hidden text-xs text-slate-400 md:inline">Not showing? Use Open in new tab.</span>}
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost">Open in new tab</a>}
          {downloadUrl && <a href={downloadUrl} className="btn-ghost">Download</a>}
        </div>
      </div>
    </div>
  );
}
