import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { canEmailAnyone, esc, sendEmail } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = { admin: 'an admin', member: 'a committee member', viewer: 'a viewer (read-only)' };

// Admins approve an access request: set the person's access, then email them that they can sign in.
export async function POST(request: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: 'Not signed in.' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ ok: false, reason: 'Admins only.' }, { status: 403 });

  const { id, role } = await request.json().catch(() => ({}));
  if (!id || !['admin', 'member', 'viewer'].includes(role)) return NextResponse.json({ ok: false, reason: 'Missing person or access level.' }, { status: 400 });

  const { data: person, error } = await supabase.from('profiles').update({ role, declined: false }).eq('id', id).select('email, full_name, role').single();
  if (error || !person) return NextResponse.json({ ok: false, reason: error?.message ?? 'Could not approve.' });

  if (!person.email) return NextResponse.json({ ok: true, emailed: false, reason: 'They have no email address on file.' });
  if (!canEmailAnyone()) {
    return NextResponse.json({ ok: true, emailed: false, to: person.email, reason: 'Approval emails start once the Resend sending domain is verified.' });
  }

  const origin = new URL(request.url).origin;
  const first = (person.full_name ?? '').split(' ')[0] || 'there';
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f8;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f8;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
    <tr><td style="background:#1b2a4a;padding:18px 24px;color:#ffffff">
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">Always In The Club</div>
      <div style="margin-top:2px;font-size:18px;font-weight:700">Programs Committee</div>
      <div style="margin-top:2px;font-size:13px;color:#e8a33d">Command Center</div>
    </td></tr>
    <tr><td style="padding:22px 24px 28px;font-size:15px;line-height:1.55;color:#334155">
      <p style="margin:0;color:#0f172a">Hi ${esc(first)},</p>
      <p style="margin:10px 0 0">You’re approved. You now have access to the Programs Committee Command Center as ${ROLE_LABEL[person.role] ?? 'a member'}.</p>
      <p style="margin:10px 0 0">Sign in with this email address (${esc(person.email)}) and the password you chose when you asked for access.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="background:#e8a33d;border-radius:12px">
        <a href="${origin}/login" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:700;color:#1b2a4a;text-decoration:none">Sign in</a>
      </td></tr></table>
      <p style="margin:20px 0 0;font-size:13px;color:#64748b">Forgot your password? Use “Forgot password” on the sign-in page.</p>
    </td></tr>
  </table></td></tr></table></body></html>`;

  const sent = await sendEmail(person.email, 'You’re approved: Programs Committee Command Center', html);
  return NextResponse.json({ ok: true, emailed: sent.ok, to: person.email, reason: sent.reason });
}
