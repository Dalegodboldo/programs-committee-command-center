import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { validateChange } from '@/lib/assistant/tools';

// Saves a change the person confirmed. Re-checks it against the allowed list and
// runs with their own session, so the database's access rules and activity log apply.
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });

  const { kind, table, id, values } = await request.json().catch(() => ({}));
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
