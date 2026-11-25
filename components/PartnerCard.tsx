'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditableField, type Column } from './EditableTable';
import Icon from './Icon';
import { StatusChip } from './ui';
import { PARTNER_STATUS } from '@/lib/options';
import type { Row } from '@/lib/types';

const PREFERRED = [{ value: '', label: '—' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone call' }, { value: 'text', label: 'Text' }, { value: 'any', label: 'Any' }];

type Field = Column & { link?: 'email' | 'phone' | 'web'; span?: boolean };

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: 'Main contact',
    fields: [
      { key: 'contact_name', label: 'Name' },
      { key: 'contact_title', label: 'Title or role' },
      { key: 'contact_email', label: 'Email', link: 'email' },
      { key: 'contact_phone', label: 'Office or direct phone', link: 'phone' },
      { key: 'contact_mobile', label: 'Mobile', link: 'phone' },
      { key: 'contact_preferred', label: 'Best way to reach', type: 'select', options: PREFERRED },
      { key: 'contact_best_time', label: 'Best times', span: true },
    ],
  },
  {
    title: 'Second contact',
    fields: [
      { key: 'contact2_name', label: 'Name' },
      { key: 'contact2_title', label: 'Title or role' },
      { key: 'contact2_email', label: 'Email', link: 'email' },
      { key: 'contact2_phone', label: 'Phone', link: 'phone' },
    ],
  },
  {
    title: 'Organization',
    fields: [
      { key: 'website', label: 'Website', link: 'web' },
      { key: 'social', label: 'Instagram or other social' },
      { key: 'main_phone', label: 'Main phone', link: 'phone' },
      { key: 'main_email', label: 'General email', link: 'email' },
      { key: 'address', label: 'Street address', type: 'textarea', span: true },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'postal_code', label: 'ZIP code' },
    ],
  },
  {
    title: 'Relationship',
    fields: [
      { key: 'introduced_by', label: 'Introduced by' },
      { key: 'last_contacted', label: 'Last contacted', type: 'date' },
      { key: 'next_step', label: 'Next step', type: 'textarea', span: true },
      { key: 'next_step_date', label: 'Next step by', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: true },
    ],
  },
];

function href(kind: Field['link'], v: string) {
  const s = v.trim();
  if (kind === 'email') return `mailto:${s}`;
  if (kind === 'phone') return `tel:${s.replace(/[^\d+]/g, '')}`;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// A full contact card for one partner, opened from the Partners list. Edits save as you go.
export default function PartnerCard({ row, canEdit, onUpdate, onClose }: { row: Row; canEdit: boolean; onUpdate: (patch: Record<string, any>) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Drawn at the page root so it always covers the whole screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const place = [row.city, row.state].filter(Boolean).join(', ');
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${row.name} contact card`}>
      <div className="flex h-full w-full max-w-xl flex-col bg-[#f3f4f8] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><Icon name="briefcase" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold leading-tight">{row.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <StatusChip value={row.status} label={PARTNER_STATUS.find((s) => s.value === row.status)?.label} />
              {place && <span>{place}</span>}
              {row.owner && <span>Lead: {row.owner}</span>}
            </div>
          </div>
          <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {SECTIONS.map((s) => (
            <section key={s.title} className="card !p-4">
              <h3 className="mb-3 text-sm font-bold">{s.title}</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {s.fields.map((f) => {
                  const v = row[f.key];
                  return (
                    <div key={f.key} className={f.span ? 'sm:col-span-2' : ''}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="label">{f.label}</span>
                        {f.link && v && String(v).trim() && (
                          <a href={href(f.link, String(v))} target={f.link === 'web' ? '_blank' : undefined} rel="noopener noreferrer"
                            className="text-xs font-semibold text-blue-700 hover:underline">
                            {f.link === 'email' ? 'Email' : f.link === 'phone' ? 'Call' : 'Open'}
                          </a>
                        )}
                        {f.link === 'phone' && v && String(v).trim() && (
                          <a href={`sms:${String(v).replace(/[^\d+]/g, '')}`} className="text-xs font-semibold text-blue-700 hover:underline">Text</a>
                        )}
                      </div>
                      <EditableField row={row} col={f} editable={canEdit} onSave={(val) => onUpdate({ [f.key]: val })} />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="pb-4 text-center text-xs text-slate-500">{canEdit ? 'Changes save as you go.' : 'Admins and committee members can edit these details.'}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
