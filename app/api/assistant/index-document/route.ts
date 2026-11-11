import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { extractText } from '@/lib/assistant/extract';

export const maxDuration = 60;

// Called right after an upload so Ask Claude can search inside the file.
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await request.json().catch(() => ({}));
  const { data: d } = await supabase.from('documents').select('id, name, storage_path').eq('id', String(id)).maybeSingle();
  if (!d) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    const content = await extractText(supabase, d.storage_path, d.name);
    const { error } = await supabase.from('document_text').upsert({ document_id: d.id, content, extracted_at: new Date().toISOString() });
    return NextResponse.json({ ok: !error, chars: content.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message });
  }
}
