'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      router.replace('/');
      router.refresh();
    }
  }

  async function reset() {
    if (!email) {
      setMsg('Enter your email first, then click "Forgot password".');
      return;
    }
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    });
    setMsg(error ? error.message : 'Check your email for a link to set a new password.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={signIn} className="card w-full max-w-sm space-y-4">
        <div>
          <img src="/aitcf-seal.png" alt="" className="mx-auto h-14 w-14" />
          <h1 className="text-lg font-semibold">Programs Committee Command Center</h1>
          <p className="text-sm text-slate-500">Private. Sign in with the email you were invited with.</p>
        </div>
        <label className="block space-y-1">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="label">Password</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
        <button className="btn-primary w-full justify-center" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="w-full text-center text-sm text-brand-600 hover:underline" onClick={reset}>
          Forgot password
        </button>
        <p className="border-t border-slate-100 pt-3 text-center text-sm text-slate-500">
          No login yet? <a href="/request-access" className="text-brand-600 hover:underline">Request access</a>
        </p>
      </form>
    </main>
  );
}
