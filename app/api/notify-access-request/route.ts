import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { notifyAdmins, esc } from '@/lib/notify';

// Emails AITCF's admins when someone requests access. Called by /request-access right after sign-up.
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log('[notify-access-request] no session after sign-up: is "Confirm email" turned off in Supabase?');
    return NextResponse.json({ ok: false, reason: 'no-session' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*') // '*' so this keeps working even before migration 003 is run
    .eq('id', user.id)
    .single();

  // Only a request made in the last few minutes, still pending, can trigger the email.
  const askedAt = profile ? new Date(profile.requested_at ?? profile.created_at).getTime() : 0;
  const fresh = Date.now() - askedAt < 10 * 60 * 1000;
  if (!profile || profile.role || profile.declined || !fresh) {
    console.log('[notify-access-request] skipped: not a fresh pending request');
    return NextResponse.json({ ok: false, reason: 'not-pending' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const result = await notifyAdmins(
    `${profile.requested_at && profile.requested_at !== profile.created_at ? 'Access request (asked again)' : 'Access request'}: ${profile.full_name ?? profile.email}`,
    `<p><b>${esc(profile.full_name)}</b> (${esc(profile.email)}) has requested access to the Programs Committee Command Center.</p>
<p><i>${esc(profile.request_note)}</i></p>
<p>Before approving, confirm with the person directly that the request is really from them.</p>
<p><a href="${origin}/team">Review the request on the Team page</a></p>`,
  );
  if (!result.ok) console.log('[notify-access-request] email not sent:', result.reason);
  return NextResponse.json({ ok: true, emailed: result.ok });
}
