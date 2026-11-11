'use client';

export default function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={`rounded-lg px-3 py-1.5 text-sm ${value === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>
          {t.label}
          {t.count != null && <span className={`ml-1.5 text-xs ${value === t.key ? 'text-brand-100' : 'text-slate-400'}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'gold' | 'red' | 'green' | 'brand' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-700',
    gold: 'bg-gold-100 text-gold-800',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-800',
    brand: 'bg-brand-50 text-brand-700',
  }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Progress({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'gold' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-2 rounded-full ${tone === 'gold' ? 'bg-gold-400' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
