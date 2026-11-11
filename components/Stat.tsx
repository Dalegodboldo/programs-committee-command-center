import Link from 'next/link';

export default function Stat({ label, value, sub, href, tone }: { label: string; value: string; sub?: string; href?: string; tone?: 'warn' | 'good' }) {
  const body = (
    <div className={`card h-full ${tone === 'warn' ? 'border-amber-300 bg-amber-50' : ''}`}>
      <p className="label">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'good' ? 'text-brand-700' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
