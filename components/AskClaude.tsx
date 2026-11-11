'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCan } from '@/components/RoleContext';

type Proposal = {
  kind: 'update' | 'create';
  table: string;
  id?: string;
  label: string;
  title: string;
  changes: { field: string; before?: any; after: any }[];
  values: Record<string, any>;
  reason?: string;
  state?: 'pending' | 'saving' | 'saved' | 'skipped' | 'error';
  error?: string;
};
type Msg = { role: 'user' | 'assistant'; content: string; proposals?: Proposal[]; error?: boolean };

const STORE = 'biff-ask-claude';
const show = (v: any) => (v === null || v === undefined || v === '' ? '(empty)' : v === true ? 'Yes' : v === false ? 'No' : String(v));
const nice = (f: string) => f.replace(/_/g, ' ');

export default function AskClaude() {
  const { canEdit } = useCan();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE);
      if (saved) setMsgs(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40)));
    } catch {}
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json().catch(() => ({ error: `Unexpected response (${res.status}).` }));
      if (data.error) setMsgs([...next, { role: 'assistant', content: data.error, error: true }]);
      else setMsgs([...next, { role: 'assistant', content: data.reply, proposals: (data.proposals ?? []).map((p: Proposal) => ({ ...p, state: 'pending' })) }]);
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'Could not reach the server. Check your connection and try again.', error: true }]);
    }
    setBusy(false);
  }

  function setProposal(mi: number, pi: number, patch: Partial<Proposal>, note?: string) {
    setMsgs((prev) =>
      prev.map((m, i) => {
        if (i !== mi || !m.proposals) return m;
        const proposals = m.proposals.map((p, j) => (j === pi ? { ...p, ...patch } : p));
        // Record the outcome in the conversation so Claude knows what was saved.
        return { ...m, proposals, content: note ? `${m.content}\n\n_${note}_` : m.content };
      }),
    );
  }

  async function confirm(mi: number, pi: number, p: Proposal) {
    setProposal(mi, pi, { state: 'saving' });
    const res = await fetch('/api/assistant/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: p.kind, table: p.table, id: p.id, values: p.values }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'Unexpected response.' }));
    if (data.ok) setProposal(mi, pi, { state: 'saved' }, `Saved: ${p.label} "${p.title}".`);
    else setProposal(mi, pi, { state: 'error', error: data.error });
  }

  const starters = canEdit
    ? ['What’s due in the next two weeks?', 'Draft the agenda for our next meeting', 'Mark my Casey meeting done', 'Which partners need a follow-up?']
    : ['What’s due in the next two weeks?', 'Summarize where the committee stands', 'What did we decide at the last meeting?', 'Which questions are still open?'];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-semibold text-white shadow-lg hover:bg-brand-700 print:hidden md:bottom-5 md:right-5 md:h-auto md:w-auto md:px-4 md:py-3"
          aria-label="Ask Claude"
        >
          <span aria-hidden className="text-lg md:text-sm">✦</span> <span className="hidden md:inline">Ask Claude</span>
        </button>
      )}

      {open && (
        <aside className="fixed inset-0 z-50 flex print:hidden flex-col bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:border-l sm:border-slate-200">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold">Ask Claude</h2>
              <p className="text-xs text-slate-500">
                {canEdit ? 'Questions, summaries, document search and small edits you confirm.' : 'Questions, summaries and document search.'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {msgs.length > 0 && (
                <button className="btn-ghost text-xs" onClick={() => setMsgs([])} disabled={busy}>New chat</button>
              )}
              <button className="btn-ghost" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-slate-500">Try one of these, or type your own:</p>
                {starters.map((s) => (
                  <button key={s} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
                <p className="pt-2 text-xs text-slate-400">
                  Ask Claude can make mistakes, so check anything important. It can't change money, people, access, files or app settings.
                </p>
              </div>
            )}

            {msgs.map((m, mi) => (
              <div key={mi} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-2xl bg-brand-600 px-3 py-2 text-white'
                      : `md ${m.error ? 'text-red-700' : 'text-slate-800'}`
                  }
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>

                {m.proposals?.map((p, pi) => (
                  <div key={pi} className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                      {p.kind === 'create' ? `Add ${p.label.toLowerCase()}` : `Change ${p.label.toLowerCase()}`}
                    </p>
                    <p className="font-medium">{p.title}</p>
                    <ul className="mt-1 space-y-0.5 text-slate-700">
                      {p.changes.map((c) => (
                        <li key={c.field}>
                          <span className="text-slate-500">{nice(c.field)}:</span>{' '}
                          {p.kind === 'update' && <><span className="line-through decoration-slate-400">{show(c.before)}</span> → </>}
                          <b>{show(c.after)}</b>
                        </li>
                      ))}
                    </ul>
                    {p.reason && <p className="mt-1 text-xs text-slate-500">{p.reason}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      {p.state === 'pending' && (
                        <>
                          <button className="btn bg-green-600 text-white hover:bg-green-700" onClick={() => confirm(mi, pi, p)}>Confirm</button>
                          <button className="btn-ghost" onClick={() => setProposal(mi, pi, { state: 'skipped' }, `Skipped: ${p.label} "${p.title}".`)}>Skip</button>
                        </>
                      )}
                      {p.state === 'saving' && <span className="text-slate-500">Saving…</span>}
                      {p.state === 'saved' && <span className="font-medium text-green-700">✓ Saved</span>}
                      {p.state === 'skipped' && <span className="text-slate-500">Skipped</span>}
                      {p.state === 'error' && <span className="text-red-700">Not saved: {p.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {busy && <p className="animate-pulse text-slate-400">Claude is working on it…</p>}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-slate-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              className="input max-h-40 min-h-[44px] flex-1 resize-y"
              rows={1}
              placeholder="Ask about action items, partners, documents…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button className="btn-primary" disabled={busy || !input.trim()}>Send</button>
          </form>
        </aside>
      )}
    </>
  );
}
