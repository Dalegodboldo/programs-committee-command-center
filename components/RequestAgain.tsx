'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function RequestAgain() {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser().rpc('request_access_again', { note: note.trim() });
    if (error || !data) {
      setBusy(false);
      return setMsg(error?.message ?? 'That did not go through. Refresh and try again.');
    }
    await fetch('/api/notify-access-request', { method: 'POST' }).catch(() => {});
    setBusy(false);
    setDone(true);
  }

  if (done) return <p className="text-sm text-green-700">Sent. AITCF will review your request again.</p>;
  return (
    <div className="space-y-2 text-left">
      <label className="block space-y-1">
        <span className="label">Anything to add? (optional)</span>
        <textarea className="input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button className="btn-primary w-full justify-center" onClick={send} disabled={busy}>
        {busy ? 'Sending…' : 'Request again'}
      </button>
    </div>
  );
}
