'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function RequestAccessPage() {
  const [form, setForm] = useState({ name: '', email: '', pw: '', pw2: '', note: '', website: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.website) return; // filled only by spam bots
    if (form.pw.length < 10) return setMsg('Choose a password of at least 10 characters.');
    if (form.pw !== form.pw2) return setMsg('The two passwords do not match.');
    setBusy(true);
    setMsg(null);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.pw,
      options: { data: { full_name: form.name.trim(), request_note: form.note.trim() } },
    });
    if (error) {
      setBusy(false);
      return setMsg(error.message);
    }
    if (data.session) {
      // Let AITCF's admins know. If email isn't set up yet, the request still appears on the Team page.
      await fetch('/api/notify-access-request', { method: 'POST' }).catch(() => {});
      await supabase.auth.signOut();
    }
    setBusy(false);
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm space-y-3 text-center">
          <img src="/aitcf-seal.png" alt="" className="mx-auto h-12 w-12" />
          <h1 className="font-semibold">Request sent</h1>
          <p className="text-sm text-slate-500">
            An admin will review your request. Once approved, sign in with the email and password you just chose.
          </p>
          <Link href="/login" className="btn-ghost justify-center">Back to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div>
          <img src="/aitcf-seal.png" alt="" className="mx-auto h-12 w-12" />
          <h1 className="text-lg font-semibold">Request access</h1>
          <p className="text-sm text-slate-500">
            For the AITCF Programs Committee Command Center. An admin reviews every request; you'll see nothing until you're approved.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="label">Full name</span>
          <input className="input" required autoComplete="name" value={form.name} onChange={set('name')} />
        </label>
        <label className="block space-y-1">
          <span className="label">Email</span>
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="block space-y-1">
          <span className="label">Choose a password</span>
          <input className="input" type="password" required autoComplete="new-password" value={form.pw} onChange={set('pw')} />
        </label>
        <label className="block space-y-1">
          <span className="label">Repeat password</span>
          <input className="input" type="password" required autoComplete="new-password" value={form.pw2} onChange={set('pw2')} />
        </label>
        <label className="block space-y-1">
          <span className="label">Your role, and why you need access</span>
          <textarea className="input" rows={3} required maxLength={1000} value={form.note} onChange={set('note')}
            placeholder="e.g. Programs Committee member" />
        </label>
        <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')}
          className="hidden" aria-hidden="true" name="website" />
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className="btn-primary w-full justify-center" disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
        <Link href="/login" className="block text-center text-sm text-brand-600 hover:underline">
          Already approved? Sign in
        </Link>
      </form>
    </main>
  );
}
