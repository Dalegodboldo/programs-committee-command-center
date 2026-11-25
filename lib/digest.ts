// The weekly task email: one per person, built from the action items and meetings.
import { esc } from '@/lib/notify';

type Row = Record<string, any>;
export type Digest = { subject: string; html: string; counts: { late: number; week: number; later: number } };

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000);
const nice = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const longNice = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

// Today's date in Pacific time, so a Monday-morning email counts Monday as today.
export function pacificToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function isMine(a: Row, fullName?: string | null) {
  if (a.owner === 'All members') return true;
  if (!fullName) return false;
  const first = fullName.split(' ')[0];
  return a.owner === fullName || (!!first && typeof a.owner === 'string' && a.owner.startsWith(first + ' '));
}

export function buildDigest(opts: { person: Row; actions: Row[]; meetings: Row[]; origin: string; today: string }): Digest {
  const { person, actions, meetings, origin, today } = opts;
  const weekOut = addDays(today, 7);
  const open = actions.filter((a) => a.status !== 'done');
  const mine = open.filter((a) => isMine(a, person.full_name)).sort((a, b) => ((a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1));
  const late = mine.filter((a) => a.due_date && a.due_date < today);
  const week = mine.filter((a) => a.due_date && a.due_date >= today && a.due_date <= weekOut);
  const later = mine.filter((a) => !a.due_date || a.due_date > weekOut);
  const allLate = open.filter((a) => a.due_date && a.due_date < today).length;
  const doneLastWeek = actions.filter((a) => a.status === 'done' && a.done_on && a.done_on >= addDays(today, -7)).length;

  const meeting = meetings
    .filter((m) => m.status === 'planned' && m.meeting_date && m.meeting_date >= today)
    .sort((a, b) => (a.meeting_date < b.meeting_date ? -1 : 1))[0];
  const meetingIn = meeting ? daysBetween(today, meeting.meeting_date) : null;

  const first = (person.full_name || '').split(' ')[0] || 'there';
  const parts = [late.length ? `${late.length} late` : '', week.length ? `${week.length} due this week` : ''].filter(Boolean);
  const subject = parts.length ? `Your week: ${parts.join(', ')}` : mine.length ? 'Your week: nothing due in the next 7 days' : 'Your week on the Programs Committee';

  const item = (a: Row, tone: 'late' | 'week' | 'later') => {
    const color = tone === 'late' ? '#991b1b' : tone === 'week' ? '#92400e' : '#475569';
    const bg = tone === 'late' ? '#fee2e2' : tone === 'week' ? '#fef3c7' : '#f1f5f9';
    const when = !a.due_date ? 'No date' : tone === 'late' ? `${daysBetween(a.due_date, today)} ${daysBetween(a.due_date, today) === 1 ? 'day' : 'days'} late` : a.due_date === today ? 'Due today' : nice(a.due_date);
    const extra = [a.owner === 'All members' ? 'Everyone' : '', a.workstream || '', a.status === 'in_progress' ? 'In progress' : a.status === 'blocked' ? 'Blocked' : ''].filter(Boolean).join(' · ');
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f4">
      <div style="font-size:15px;line-height:1.4;color:#0f172a">${esc(a.title)}</div>
      <div style="margin-top:5px;font-size:12px;color:#64748b">
        <span style="display:inline-block;padding:2px 9px;border-radius:999px;background:${bg};color:${color};font-weight:600">${esc(when)}</span>
        ${extra ? `&nbsp; ${esc(extra)}` : ''}
      </div></td></tr>`;
  };
  const group = (title: string, color: string, rows: Row[], tone: 'late' | 'week' | 'later', limit = 15) =>
    rows.length
      ? `<h2 style="margin:22px 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${color}">${title} (${rows.length})</h2>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.slice(0, limit).map((a) => item(a, tone)).join('')}</table>
         ${rows.length > limit ? `<p style="margin:6px 0 0;font-size:13px;color:#64748b">and ${rows.length - limit} more</p>` : ''}`
      : '';

  const intro = mine.length === 0
    ? person.full_name
      ? 'Nothing open has your name on it right now.'
      : 'Your name isn’t set on your Command Center account yet, so your items can’t be matched. An admin can add it on the Team page.'
    : late.length || week.length
      ? `Here’s what’s on your plate. You have ${parts.join(' and ')}.`
      : 'Nothing is late or due in the next 7 days. Here’s what’s coming up.';

  const meetingBox = meeting
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="background:#1b2a4a;border-radius:14px;padding:16px 18px;color:#ffffff">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#e8a33d">Next meeting</div>
        <div style="margin-top:4px;font-size:18px;font-weight:700">${esc(longNice(meeting.meeting_date))}${meetingIn === 0 ? ' (today)' : meetingIn === 1 ? ' (tomorrow)' : ` (in ${meetingIn} days)`}</div>
        <div style="font-size:14px;color:#cbd5e1">${esc(meeting.title)}</div>
      </td></tr></table>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f8;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f8;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
    <tr><td style="background:#1b2a4a;padding:18px 24px;color:#ffffff">
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">Always In The Club</div>
      <div style="margin-top:2px;font-size:18px;font-weight:700">Programs Committee</div>
      <div style="margin-top:2px;font-size:13px;color:#e8a33d">Your week · ${esc(longNice(today))}</div>
    </td></tr>
    <tr><td style="padding:22px 24px 28px">
      <p style="margin:0;font-size:16px;color:#0f172a">Hi ${esc(first)},</p>
      <p style="margin:8px 0 0;font-size:15px;line-height:1.5;color:#334155">${intro}</p>
      ${group('Late', '#991b1b', late, 'late')}
      ${group('Due this week', '#92400e', week, 'week')}
      ${group('Coming up', '#475569', later, 'later', 6)}
      ${meetingBox}
      <p style="margin:22px 0 0;font-size:13px;color:#64748b">Across the committee: ${open.length} open ${open.length === 1 ? 'item' : 'items'}, ${allLate} late${doneLastWeek ? `, ${doneLastWeek} finished in the last week` : ''}.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="background:#e8a33d;border-radius:12px">
        <a href="${origin}/actions?view=mine" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:700;color:#1b2a4a;text-decoration:none">Open my action items</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:14px 24px;background:#f8fafc;font-size:12px;color:#64748b;line-height:1.5">
      You get this every Monday from the Programs Committee Command Center. To stop it, switch off “Weekly email” on the <a href="${origin}/team" style="color:#1d4ed8">Team page</a>.
    </td></tr>
  </table></td></tr></table></body></html>`;

  return { subject, html, counts: { late: late.length, week: week.length, later: later.length } };
}

// Sends many emails through Resend in batches of up to 100.
export async function sendBatch(messages: { to: string; subject: string; html: string }[]): Promise<{ sent: number; errors: string[] }> {
  const key = (process.env.RESEND_API_KEY ?? '').trim();
  if (!key) return { sent: 0, errors: ['RESEND_API_KEY is not set in Vercel.'] };
  const from = process.env.NOTIFY_FROM || 'AITCF Programs Committee <onboarding@resend.dev>';
  let sent = 0;
  const errors: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html }));
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
      else {
        const body = await res.json().catch(() => ({}));
        errors.push(`Resend said: ${body?.message ?? res.statusText} (code ${res.status})`);
      }
    } catch (e: any) {
      errors.push(`Could not reach Resend: ${e?.message ?? e}`);
    }
  }
  return { sent, errors };
}
