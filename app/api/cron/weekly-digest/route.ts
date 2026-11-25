import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildDigest, pacificToday, sendBatch } from '@/lib/digest';

export const dynamic = 'force-dynamic';

const SITE = 'https://programs-committee.alwaysintheclub.org';

// Runs every Monday morning (vercel.json). Vercel signs the call with CRON_SECRET.
export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (!secret) return NextResponse.json({ ok: false, reason: 'CRON_SECRET is not set in Vercel.' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: 'SUPABASE_SECRET_KEY is not set in Vercel.' }, { status: 500 });

  const [people, actions, meetings] = await Promise.all([
    db.from('profiles').select('id, email, full_name, role, weekly_email').in('role', ['admin', 'member']),
    db.from('action_items').select('*'),
    db.from('meetings').select('*'),
  ]);
  const failed = people.error ?? actions.error ?? meetings.error;
  if (failed) return NextResponse.json({ ok: false, reason: failed.message }, { status: 500 });

  let recipients = (people.data ?? []).filter((p) => p.email && ['admin', 'member'].includes(p.role) && p.weekly_email !== false);
  // Until a sending domain is verified in Resend, it only delivers to the account owner's address.
  // Until then, admins' emails go to the access-alert address and everyone else is skipped.
  let skipped: string[] = [];
  const deliverTo = new Map<string, string>();
  if (!process.env.NOTIFY_FROM) {
    const alertTo = (process.env.ADMIN_NOTIFY_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)[0];
    skipped = recipients.filter((p) => p.role !== 'admin' || !alertTo).map((p) => p.email);
    recipients = recipients.filter((p) => p.role === 'admin' && alertTo);
    recipients.forEach((p) => deliverTo.set(p.id, alertTo!));
  }

  const today = pacificToday();
  const messages = recipients.map((p) => {
    const d = buildDigest({ person: p, actions: actions.data ?? [], meetings: meetings.data ?? [], origin: SITE, today });
    return { to: deliverTo.get(p.id) ?? (p.email as string), subject: d.subject, html: d.html };
  });
  const result = await sendBatch(messages);

  await db.from('activity_log').insert({
    table_name: 'weekly_email',
    action: 'sent',
    actor_name: 'Command Center',
    summary: `to ${result.sent} ${result.sent === 1 ? 'person' : 'people'}${skipped.length ? ` (${skipped.length} waiting on the Resend domain)` : ''}`,
  });

  return NextResponse.json({ ok: result.errors.length === 0, sent: result.sent, skipped, errors: result.errors });
}
