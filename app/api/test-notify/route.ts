import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { notifyAdmins, notifyConfig } from '@/lib/notify';

// Admin-only: sends a test alert and reports exactly what happened.
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'Not signed in.' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ ok: false, reason: 'Admins only.' }, { status: 403 });

  const cfg = notifyConfig();
  if (cfg.hasKey && !cfg.keyLooksRight)
    return NextResponse.json({ ok: false, reason: 'RESEND_API_KEY is set but does not start with re_. Re-copy the key from Resend.' });

  const origin = new URL(request.url).origin;
  const result = await notifyAdmins(
    'Test: Programs Committee access alerts are working',
    `<p>This is a test from the Programs Committee Command Center. Access-request alerts will arrive at this address.</p><p><a href="${origin}/team">Open the Team page</a></p>`,
  );
  return NextResponse.json({ ...result, recipients: cfg.to });
}
