'use client';

import { useEffect, useState } from 'react';
import type { Row } from '@/lib/types';

export type Column = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'checkbox' | 'computed';
  options?: { value: string; label: string }[];
  editable?: boolean; // defaults to the table's canEdit
  width?: string;
  render?: (row: Row) => React.ReactNode; // for computed columns
};

type Props = {
  rows: Row[];
  columns: Column[];
  canEdit: boolean;
  onUpdate: (id: string, patch: Record<string, any>) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  addLabel?: string;
  empty?: string;
  rowActions?: (row: Row) => React.ReactNode;
  rowEditable?: (row: Row) => boolean;
};

export default function EditableTable({
  rows, columns, canEdit, onUpdate, onAdd, onDelete, addLabel = 'Add row', empty = 'Nothing here yet.', rowActions, rowEditable,
}: Props) {
  return (
    <div>
      {/* Phones: one card per row, fields stacked, actions at the bottom */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{empty}</p>}
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="space-y-2">
              {columns.map((c) => (
                <div key={c.key} className={c.type === 'checkbox' ? 'flex items-center justify-between gap-3' : ''}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
                  <div className={c.type === 'checkbox' ? '' : 'mt-0.5'}>
                    <Cell row={row} col={c} editable={(c.editable ?? canEdit) && (rowEditable ? rowEditable(row) : true)} onSave={(v) => onUpdate(row.id, { [c.key]: v })} />
                  </div>
                </div>
              ))}
            </div>
            {(rowActions || (canEdit && onDelete)) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {rowActions?.(row)}
                {canEdit && onDelete && (
                  <button className="btn-danger ml-auto" onClick={() => { if (confirm('Delete this row? This cannot be undone.')) onDelete(row.id); }}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-2 font-medium text-slate-500" style={{ minWidth: c.width }}>
                  {c.label}
                </th>
              ))}
              {(rowActions || (canEdit && onDelete)) && <th className="w-24" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-6 text-center text-slate-400">
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    <Cell row={row} col={c} editable={(c.editable ?? canEdit) && (rowEditable ? rowEditable(row) : true)} onSave={(v) => onUpdate(row.id, { [c.key]: v })} />
                  </td>
                ))}
                {(rowActions || (canEdit && onDelete)) && (
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {rowActions?.(row)}
                    {canEdit && onDelete && (
                      <button
                        className="btn-danger"
                        title="Delete"
                        onClick={() => {
                          if (confirm('Delete this row? This cannot be undone.')) onDelete(row.id);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && onAdd && (
        <button className="btn-ghost mt-3" onClick={onAdd}>
          + {addLabel}
        </button>
      )}
    </div>
  );
}

function Cell({ row, col, editable, onSave }: { row: Row; col: Column; editable: boolean; onSave: (v: any) => void }) {
  const value = row[col.key];
  const [draft, setDraft] = useState<string>(toText(value));
  const [focused, setFocused] = useState(false);

  // Take in changes made by other people unless this cell is being edited right now.
  useEffect(() => {
    if (!focused) setDraft(toText(value));
  }, [value, focused]);

  if (col.type === 'computed') return <span>{col.render?.(row)}</span>;

  if (!editable) {
    if (col.type === 'checkbox') return <span>{value ? '✓' : ''}</span>;
    if (col.type === 'select') return <span>{col.options?.find((o) => o.value === value)?.label ?? value}</span>;
    if (col.type === 'money') return <span>{value == null ? '' : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>;
    return <span className="whitespace-pre-wrap">{toText(value)}</span>;
  }

  if (col.type === 'checkbox') {
    return <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!value} onChange={(e) => onSave(e.target.checked)} />;
  }

  if (col.type === 'select') {
    return (
      <select className="input" value={value ?? ''} onChange={(e) => onSave(e.target.value === '' ? null : e.target.value)}>
        {col.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  const commit = () => {
    setFocused(false);
    if (draft === toText(value)) return;
    if (col.type === 'number' || col.type === 'money') {
      const n = draft.trim() === '' ? null : Number(draft.replace(/[$,]/g, ''));
      if (n !== null && Number.isNaN(n)) {
        setDraft(toText(value));
        return;
      }
      onSave(n);
    } else if (col.type === 'date') {
      onSave(draft || null);
    } else {
      onSave(draft);
    }
  };

  const common = {
    className: 'input',
    value: draft,
    onFocus: () => setFocused(true),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
  };

  if (col.type === 'textarea') return <textarea rows={1} {...common} />;
  return (
    <input
      {...common}
      type={col.type === 'date' ? 'date' : 'text'}
      inputMode={col.type === 'number' || col.type === 'money' ? 'decimal' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function toText(v: any): string {
  return v == null ? '' : String(v);
}
