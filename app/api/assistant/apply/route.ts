import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { validateChange } from '@/lib/assistant/tools';
import { applyPatch, normalize, validatePatch } from '@/lib/settings';

// Saves a change the person confirmed. Re-checks it against the allowed list and
// runs with their own session, so the database's access rules and activity log apply.
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });

  const { kind, table, id, values } = await request.json().catch(() => ({}));

  // App design: admins only. Merged onto the current settings at the moment of saving.
  if (kind === 'design') {
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return NextResponse.json({ ok: false, error: 'Only admins can change the app design.' }, { status: 403 });
    const check = validatePatch(values);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.error });
    const { data: row, error: readError } = await supabase.from('app_settings').select('settings').eq('id', 'site').maybeSingle();
    if (readError || !row) return NextResponse.json({ ok: false, error: 'Design settings are not set up yet. Run the app_settings SQL in Supabase first.' });
    const next = applyPatch(normalize(row.settings), check.patch);
    const { data, error } = await supabase.from('app_settings').update({ settings: next }).eq('id', 'site').select('id');
    if (error) return NextResponse.json({ ok: false, error: error.message });
    if (!data?.length) return NextResponse.json({ ok: false, error: "That wasn't saved. You may not have permission to change it." });
    return NextResponse.json({ ok: true });
  }

  const creating = kind === 'create';
  const check = validateChange(String(table), values, creating);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error });

  const q = creating
    ? supabase.from(table).insert(check.values).select('id')
    : supabase.from(table).update(check.values).eq('id', String(id)).select('id');
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message });
  if (!data?.length) return NextResponse.json({ ok: false, error: "That wasn't saved. You may not have permission to change it." });
  return NextResponse.json({ ok: true });
}
