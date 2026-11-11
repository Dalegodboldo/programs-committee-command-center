'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function SetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setMsg('Use at least 10 characters.');
    if (pw !== pw2) return setMsg('The two passwords do not match.');
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) setMsg(error.message);
    else router.replace('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={save} className="card w-full max-w-sm space-y-4">
        <h1 className="text-lg font-semibold">Set a new password</h1>
        <p className="text-sm text-slate-500">At least 10 characters. You'll stay signed in.</p>
        <input className="input" type="password" placeholder="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" placeholder="Repeat it" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className="btn-primary w-full justify-center">Save and continue</button>
      </form>
    </main>
  );
}
