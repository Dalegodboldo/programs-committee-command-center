'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCan } from '@/components/RoleContext';
import { useSettings } from '@/components/SettingsContext';
import { supabaseBrowser } from '@/lib/supabase/client';
import { NAV_LINKS } from '@/lib/nav';
import {
  ALWAYS_SHOWN,
  DEFAULT_SETTINGS,
  OVERVIEW_BLOCKS,
  applyPatch,
  contrast,
  cssVars,
  normalize,
  pairWarning,
  validatePatch,
  type Settings,
} from '@/lib/settings';

const PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: 'Navy & Gold', primary: '#1b2a4a', accent: '#e8a33d' },
  { name: 'Midnight & Teal', primary: '#12303d', accent: '#3cc6b4' },
  { name: 'Plum & Rose', primary: '#3b1f4a', accent: '#f07aa0' },
  { name: 'Forest & Amber', primary: '#1d3b2a', accent: '#f2b632' },
  { name: 'Charcoal & Coral', primary: '#2b2d33', accent: '#ff7f5c' },
  { name: 'Royal & Sky', primary: '#22307a', accent: '#5cc2f2' },
];

export default function DesignPage() {
  const { isAdmin } = useCan();
  const { settings, reload } = useSettings();
  const [draft, setDraft] = useState<Settings>(settings);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // When someone else (or Ask Claude) saves, pick it up unless there are unsaved edits here.
  const dirty = useMemo(() => JSON.stringify(normalize(draft)) !== JSON.stringify(settings), [draft, settings]);
  useEffect(() => {
    if (!dirty) setDraft(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  if (!isAdmin) return <p className="card text-sm text-slate-500">The Design page is for admins only.</p>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setStatus(null);
  };

  async function save(next: Settings, done: string) {
    const check = validatePatch(next);
    if (!check.ok) return setStatus({ tone: 'error', text: check.error });
    setSaving(true);
    const value = applyPatch(normalize(next), check.patch);
    const { data, error } = await supabaseBrowser().from('app_settings').update({ settings: value }).eq('id', 'site').select('id');
    setSaving(false);
    if (error || !data?.length) {
      return setStatus({ tone: 'error', text: error?.message ?? "Not saved. The design settings table may not be set up yet (run 005_app_settings.sql in Supabase)." });
    }
    await reload();
    setDraft(value);
    setConfirmReset(false);
    setStatus({ tone: 'ok', text: done });
  }

  const primaryOk = /^#[0-9a-f]{6}$/i.test(draft.primary);
  const accentOk = /^#[0-9a-f]{6}$/i.test(draft.accent);
  const preview = primaryOk && accentOk ? (cssVars(draft) as React.CSSProperties) : undefined;
  const warning = primaryOk && accentOk ? pairWarning(draft) : null;
  const colorCheck = validatePatch({ primary: draft.primary, accent: draft.accent });

  const move = (list: string[], i: number, by: number) => {
    const out = [...list];
    const j = i + by;
    if (j < 0 || j >= out.length) return out;
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Design</h1>
          <p className="text-sm text-slate-500">How the Command Center looks for everyone. Admins only. You can also ask Ask Claude, for example “make the header plum” or “move Mentoring above Spotlight”.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!dirty || saving} onClick={() => { setDraft(settings); setStatus(null); }}>Undo edits</button>
          <button className="btn-primary" disabled={!dirty || saving} onClick={() => save(draft, 'Saved. Everyone sees the new design now.')}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </header>

      {status && (
        <p className={`rounded-lg px-3 py-2 text-sm ${status.tone === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{status.text}</p>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="font-semibold">Colors</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((p) => {
              const on = draft.primary === p.primary && draft.accent === p.accent;
              return (
                <button
                  key={p.name}
                  onClick={() => { set('primary', p.primary); set('accent', p.accent); }}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs ${on ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="flex shrink-0 overflow-hidden rounded">
                    <span className="h-6 w-5" style={{ background: p.primary }} />
                    <span className="h-6 w-3" style={{ background: p.accent }} />
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
          <ColorField label="Main color" hint="Menu highlights, buttons and dark panels. White text sits on it." value={draft.primary} onChange={(v) => set('primary', v)} />
          <ColorField label="Highlight color" hint="Labels, progress bars and tags." value={draft.accent} onChange={(v) => set('accent', v)} />
          {primaryOk && <p className="text-xs text-slate-500">White text on the main color: {contrast(draft.primary, '#ffffff').toFixed(1)}:1 contrast (4.5 or more reads well).</p>}
          {!colorCheck.ok && <p className="text-sm text-red-700">{colorCheck.error}</p>}
          {warning && <p className="text-sm text-amber-700">{warning}</p>}
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold">Preview</h2>
          <div style={preview} className="space-y-3">
            <div className="rounded-xl bg-brand-700 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">Next meeting</p>
              <p className="mt-1 text-xl font-semibold">Wednesday, December 9</p>
              <p className="text-sm text-brand-100">Programs Committee Meeting 2</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="btn bg-brand-600 text-white">Save</span>
              <span className="text-sm text-brand-600 underline">A link</span>
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-800">In progress</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 rounded-full bg-gold-400" /></div>
            {draft.announcement && <div className="whitespace-pre-line rounded-xl border border-gold-400 bg-gold-50 px-4 py-3 text-sm text-gold-800">{draft.announcement}</div>}
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Names and messages</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="App name" max={40} value={draft.appName} onChange={(v) => set('appName', v)} />
          <TextField label="Subtitle" max={40} value={draft.appSubtitle} onChange={(v) => set('appSubtitle', v)} />
        </div>
        <TextField label="Welcome line (Overview, under “Welcome, name”)" max={200} value={draft.welcome} onChange={(v) => set('welcome', v)} multiline />
        <TextField label="Announcement banner (top of the Overview; leave empty for none)" max={300} value={draft.announcement} onChange={(v) => set('announcement', v)} multiline />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-1 font-semibold">Menu</h2>
          <p className="mb-3 text-xs text-slate-500">Order, names and which pages appear. Hiding a page only takes it off the menu; access rules don't change. Overview, Team and Design always stay.</p>
          <ul className="divide-y divide-slate-100">
            {draft.navOrder.map((href, i) => {
              const link = NAV_LINKS.find((l) => l.href === href);
              if (!link) return null;
              const hidden = draft.navHidden.includes(href);
              const locked = ALWAYS_SHOWN.includes(href);
              const who = (link as any).adminOnly ? 'Admins' : (link as any).editorsOnly ? 'Members' : null;
              return (
                <li key={href} className={`flex items-center gap-2 py-2 ${hidden ? 'opacity-50' : ''}`}>
                  <span className="w-6 text-center text-lg">{link.icon}</span>
                  <input
                    className="input min-w-0 flex-1"
                    value={draft.navLabels[href] ?? ''}
                    placeholder={link.label}
                    maxLength={30}
                    onChange={(e) => set('navLabels', { ...draft.navLabels, [href]: e.target.value })}
                    aria-label={`Menu name for ${link.label}`}
                  />
                  {who && <span className="hidden text-[10px] uppercase text-slate-400 sm:inline">{who}</span>}
                  <label className={`flex items-center gap-1 text-xs ${locked ? 'text-slate-300' : 'text-slate-600'}`} title={locked ? 'Always shown' : ''}>
                    <input type="checkbox" checked={!hidden} disabled={locked} onChange={() => set('navHidden', toggle(draft.navHidden, href))} />
                    Show
                  </label>
                  <Arrows onUp={() => set('navOrder', move(draft.navOrder, i, -1))} onDown={() => set('navOrder', move(draft.navOrder, i, 1))} first={i === 0} last={i === draft.navOrder.length - 1} />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <h2 className="mb-1 font-semibold">Overview layout</h2>
          <p className="mb-3 text-xs text-slate-500">The order of the main blocks on the Overview, top to bottom.</p>
          <ul className="divide-y divide-slate-100">
            {draft.overviewOrder.map((key, i) => {
              const block = OVERVIEW_BLOCKS.find((b) => b.key === key);
              if (!block) return null;
              const hidden = draft.overviewHidden.includes(key);
              return (
                <li key={key} className={`flex items-center gap-2 py-2 ${hidden ? 'opacity-50' : ''}`}>
                  <span className="min-w-0 flex-1 text-sm">{block.label}</span>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" checked={!hidden} onChange={() => set('overviewHidden', toggle(draft.overviewHidden, key))} />
                    Show
                  </label>
                  <Arrows onUp={() => set('overviewOrder', move(draft.overviewOrder, i, -1))} onDown={() => set('overviewOrder', move(draft.overviewOrder, i, 1))} first={i === 0} last={i === draft.overviewOrder.length - 1} />
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Start over</h2>
          <p className="text-sm text-slate-500">Put every design setting back to the original navy and gold look.</p>
        </div>
        {confirmReset ? (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={saving} onClick={() => save({ ...DEFAULT_SETTINGS, navLabels: Object.fromEntries(Object.keys(settings.navLabels).map((h) => [h, ''])) }, 'Back to the original design.')}>
              Yes, reset everything
            </button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setConfirmReset(true)}>Reset to defaults</button>
        )}
      </section>
    </div>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div>
      <p className="label">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5" aria-label={label} />
        <input className="input w-32 font-mono" value={value} maxLength={7} onChange={(e) => onChange(e.target.value.trim().toLowerCase())} aria-label={`${label} hex`} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function TextField({ label, value, onChange, max, multiline }: { label: string; value: string; onChange: (v: string) => void; max: number; multiline?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {multiline ? (
        <textarea className="input mt-1 min-h-[3.5rem]" rows={2} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input mt-1" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
      )}
      <span className="mt-0.5 block text-right text-[11px] text-slate-400">{value.length}/{max}</span>
    </label>
  );
}

function Arrows({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  return (
    <span className="flex shrink-0">
      <button className="btn-ghost px-2" disabled={first} onClick={onUp} aria-label="Move up">↑</button>
      <button className="btn-ghost ml-1 px-2" disabled={last} onClick={onDown} aria-label="Move down">↓</button>
    </span>
  );
}
