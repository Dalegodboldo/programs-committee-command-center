import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'documents';
const MAX_CHARS = 400_000;

// Pulls plain text out of an uploaded file. Returns '' for formats we can't read (images, spreadsheets, etc.).
export async function extractText(supabase: SupabaseClient, storagePath: string, name: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Could not open the file: ${error?.message ?? 'not found'}`);
  const buf = new Uint8Array(await data.arrayBuffer());
  const ext = name.toLowerCase().split('.').pop() ?? '';

  let text = '';
  if (ext === 'pdf') {
    const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(buf);
    const out = await pdfText(pdf, { mergePages: false });
    text = (out.text as string[]).map((t, i) => `[Page ${i + 1}]\n${t}`).join('\n\n');
  } else if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const out = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    text = out.value;
  } else if (['txt', 'md', 'csv', 'tsv', 'json', 'html', 'htm', 'rtf'].includes(ext)) {
    text = new TextDecoder().decode(buf);
    if (ext === 'html' || ext === 'htm') text = text.replace(/<[^>]+>/g, ' ');
  }
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
}

// Cached text for a document; extracts and (for editors) saves it if missing.
export async function getDocumentText(
  supabase: SupabaseClient,
  doc: { id: string; name: string; storage_path: string },
  canCache: boolean,
): Promise<string> {
  const { data: cached } = await supabase.from('document_text').select('content').eq('document_id', doc.id).maybeSingle();
  if (cached) return cached.content;
  const text = await extractText(supabase, doc.storage_path, doc.name);
  if (canCache) await supabase.from('document_text').upsert({ document_id: doc.id, content: text, extracted_at: new Date().toISOString() });
  return text;
}
