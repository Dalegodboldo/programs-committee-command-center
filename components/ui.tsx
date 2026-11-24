// Small shared pieces for the color-coded look: chips, avatars, section icons and page headers.
import Icon from './Icon';
import { dueInfo, initials, personColor, sectionStyle, statusTone, workstreamTone } from '@/lib/colors';

export function Chip({ children, cls, className = '' }: { children: React.ReactNode; cls: string; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls} ${className}`}>{children}</span>;
}

export function WorkstreamChip({ value }: { value?: string | null }) {
  if (!value) return null;
  return <Chip cls={workstreamTone(value).chip}>{value}</Chip>;
}

export function StatusChip({ value, label }: { value?: string | null; label?: string }) {
  if (!value) return null;
  return <Chip cls={statusTone(value)?.chip ?? 'bg-slate-100 text-slate-700'}>{label ?? value}</Chip>;
}

export function DueChip({ due, status, today }: { due?: string | null; status?: string | null; today?: string }) {
  const d = dueInfo(due, status, today);
  return <Chip cls={d.cls}>{d.label}</Chip>;
}

export function Avatar({ name, size = 'h-7 w-7 text-[10px]' }: { name?: string | null; size?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${size} ${personColor(name)}`} title={name ?? undefined} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function SectionIcon({ href, size = 'h-8 w-8', iconSize = 'h-[18px] w-[18px]', className = '' }: { href: string; size?: string; iconSize?: string; className?: string }) {
  const s = sectionStyle(href);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-[10px] ${size} ${s.tile} ${className}`}>
      <Icon name={s.icon} className={iconSize} />
    </span>
  );
}

export function PageHeader({ href, title, children, actions }: { href: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3.5">
        <SectionIcon href={href} size="h-11 w-11" iconSize="h-[22px] w-[22px]" className="rounded-xl" />
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {children && <p className="text-sm text-slate-500">{children}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
