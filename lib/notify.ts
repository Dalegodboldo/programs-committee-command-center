// Sends an email to AITCF's admins through Resend.
// Vercel environment variables (server-only):
//   RESEND_API_KEY        from resend.com
//   ADMIN_NOTIFY_EMAILS   comma-separated admin addresses
//   NOTIFY_FROM           optional, once a sending domain is verified in Resend
export function notifyConfig() {
  const key = (process.env.RESEND_API_KEY ?? '').trim();
  const to = (process.env.ADMIN_NOTIFY_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return { key, to, hasKey: key.length > 0, keyLooksRight: key.startsWith('re_') };
}

export async function notifyAdmins(subject: string, html: string): Promise<{ ok: boolean; reason?: string }> {
  const { key, to } = notifyConfig();
  if (!key) return { ok: false, reason: 'RESEND_API_KEY is not set in Vercel (or the site was not redeployed after adding it).' };
  if (to.length === 0) return { ok: false, reason: 'ADMIN_NOTIFY_EMAILS is not set in Vercel (or the site was not redeployed after adding it).' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'AITCF Programs Committee <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: `Resend said: ${body?.message ?? res.statusText} (code ${res.status})` };
  } catch (e: any) {
    return { ok: false, reason: `Could not reach Resend: ${e?.message ?? e}` };
  }
}

export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
