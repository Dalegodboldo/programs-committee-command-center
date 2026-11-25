import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { buildDigest, pacificToday, sendBatch } from '@/lib/digest';

export const dynamic = 'force-dynamic';

// Admins: preview your own weekly email (GET returns the page) or send it to yourself (POST).
async function build(request: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.', status: 401 } as const;
  const { data: me } = await supabase.from('profiles').select('email, full_name, role').eq('id', user.id).single();
  if (me?.role !== 'admin') return { error: 'Admins only.', status: 403 } as const;
  const [actions, meetings] = await Promise.all([supabase.from('action_items').select('*'), supabase.from('meetings').select('*')]);
  const origin = new URL(request.url).origin;
  return { me, digest: buildDigest({ person: me, actions: actions.data ?? [], meetings: meetings.data ?? [], origin, today: pacificToday() }) } as const;
}

export async function GET(request: Request) {
  const r = await build(request);
  if ('error' in r) return new NextResponse(r.error, { status: r.status });
  return new NextResponse(r.digest.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(request: Request) {
  const r = await build(request);
  if ('error' in r) return NextResponse.json({ ok: false, reason: r.error }, { status: r.status });
  // Until a sending domain is verified in Resend, it only delivers to the Resend account's own
  // address (the access-alert address), so the test goes there.
  const alertTo = (process.env.ADMIN_NOTIFY_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)[0];
  const to = process.env.NOTIFY_FROM ? r.me.email : alertTo || r.me.email;
  if (!to) return NextResponse.json({ ok: false, reason: 'Your account has no email address.' });
  const result = await sendBatch([{ to, subject: `[Test] ${r.digest.subject}`, html: r.digest.html }]);
  return NextResponse.json({ ok: result.errors.length === 0, reason: result.errors[0] ? `${result.errors[0]} Tried to send to ${to}.` : undefined, to });
}
