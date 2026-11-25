'use client';

import Link from 'next/link';
import { useLiveTable } from '@/lib/useLiveTable';
import { useCan } from '@/components/RoleContext';
import { Avatar, DueChip, PageHeader, StatusChip } from '@/components/ui';
import { ExternalButton } from '@/components/Tabs';
import ErrorBar from '@/components/ErrorBar';
import Icon from '@/components/Icon';
import { DOCUSIGN_URL, PARTNER_STATUS } from '@/lib/options';
import { firstName } from '@/lib/colors';
import { addDays, longDate, today } from '@/lib/dates';
import type { Row } from '@/lib/types';

const STREAM = 'Playground Scholarship';

// One place for the Playground Scholarship: its action items, the Playground partner record,
// its files, and DocuSign for the paperwork. Everything here comes from the existing lists.
export default function ScholarshipPage() {
  const { canEdit } = useCan();
  const actions = useLiveTable('action_items', { orderBy: 'due_date' });
  const partners = useLiveTable('partners', { orderBy: 'name' });
  const docs = useLiveTable('documents', { orderBy: 'created_at', ascending: false });
  const t = today();

  const items = actions.rows.filter((a) => a.workstream === STREAM);
  const open = items.filter((a) => a.status !== 'done').sort(byDue);
  const done = items.filter((a) => a.status === 'done').sort((a, b) => ((a.done_on ?? '') < (b.done_on ?? '') ? 1 : -1));
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
  const partner = partners.rows.find((p) => /playground/i.test(p.name ?? ''));
  const files = docs.rows.filter((d) => d.folder === 'playground');

  const addItem = () => actions.insert({ title: 'New scholarship task', workstream: STREAM, due_date: addDays(t, 7) });

  return (
    <div className="space-y-5">
      <PageHeader href="/scholarship" title="Playground Scholarship"
        actions={<>
          {canEdit && <ExternalButton href={DOCUSIGN_URL} title="Opens DocuSign in a new tab. Save signed copies in the Playground Scholarship folder.">Open DocuSign</ExternalButton>}
          {canEdit && <button className="btn-primary" onClick={addItem}>+ Add task</button>}
        </>}>
        The scholarship with The Playground, Los Angeles: tasks, the partner relationship, files and signed paperwork in one place.
      </PageHeader>

      <ErrorBar error={actions.error ?? partners.error} onClose={() => { actions.setError(null); partners.setError(null); }} />

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Tasks</h2>
            <span className="text-sm text-slate-500">{done.length} of {items.length} done</span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-lime-100"><div className="h-full rounded-full bg-lime-600" style={{ width: `${pct}%` }} /></div>
          {open.length === 0 ? (
            <p className="text-sm text-slate-500">
              {items.length ? 'Everything is done.' : `No tasks yet. Add one here, or tag any action item with the ${STREAM} workstream.`}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {open.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                  {canEdit ? (
                    <button className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-slate-300 bg-white hover:border-green-600 hover:bg-green-50"
                      title="Mark done" aria-label={`Mark done: ${a.title}`} onClick={() => actions.update(a.id, { status: 'done' })} />
                  ) : <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-slate-300 bg-white" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {a.owner ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"><Avatar name={a.owner} size="h-5 w-5 text-[8px]" />{firstName(a.owner)}</span> : <span className="text-xs text-slate-400">No owner</span>}
                      <DueChip due={a.due_date} status={a.status} today={t} />
                      {a.status === 'in_progress' && <StatusChip value="in_progress" label="In progress" />}
                      {a.status === 'blocked' && <StatusChip value="blocked" label="Blocked" />}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-600">Done ({done.length})</summary>
              <ul className="mt-2 space-y-1.5 text-slate-500">
                {done.map((a) => <li key={a.id} className="line-through decoration-slate-300">{a.title}</li>)}
              </ul>
            </details>
          )}
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Owners, dates and details are edited on <Link href={`/actions?stream=${encodeURIComponent(STREAM)}`} className="font-semibold text-blue-700 hover:underline">Action items</Link>.
          </p>
        </div>

        <div className="space-y-5">
          <div className="card">
            <h2 className="mb-3 font-bold">Partner</h2>
            {partner ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{partner.name}</span>
                  <StatusChip value={partner.status} label={PARTNER_STATUS.find((s) => s.value === partner.status)?.label} />
                </div>
                {partner.owner && <p className="flex items-center gap-2 text-slate-600"><Avatar name={partner.owner} size="h-5 w-5 text-[8px]" />Lead: {partner.owner}</p>}
                {(partner.next_step || partner.next_step_date) && (
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Next step:</span> {partner.next_step || 'Not set'}
                    {partner.next_step_date ? ` (${longDate(partner.next_step_date)})` : ''}
                  </p>
                )}
                {partner.notes && <p className="whitespace-pre-line text-slate-600">{partner.notes}</p>}
                <Link href="/partners" className="inline-block pt-1 text-xs font-semibold text-blue-700 hover:underline">Edit on Partners &amp; funding</Link>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No partner named “Playground” yet. Add The Playground on <Link href="/partners" className="font-semibold text-blue-700 hover:underline">Partners &amp; funding</Link>.</p>
            )}
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-bold">Files</h2>
              <Link href="/documents?folder=playground" className="text-sm font-semibold text-blue-700 hover:underline">Open folder</Link>
            </div>
            {!canEdit ? (
              <p className="text-sm text-slate-500">Scholarship files are open to admins and committee members only.</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-slate-500">No files yet. Upload them to Documents › Playground Scholarship.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {files.slice(0, 8).map((d: Row) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <Icon name="folder" className="h-4 w-4 shrink-0 text-lime-700" />
                    <span className="min-w-0 flex-1 truncate">{d.subpath ? `${d.subpath.split('/').join(' / ')} / ` : ''}{d.name}</span>
                    <span className="whitespace-nowrap text-xs text-slate-500">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </li>
                ))}
                {files.length > 8 && <li className="text-xs text-slate-500">and {files.length - 8} more in the folder</li>}
              </ul>
            )}
          </div>

          {canEdit && (
            <div className="rounded-2xl bg-lime-50 p-5 text-sm text-lime-900">
              <h2 className="mb-2 flex items-center gap-2 font-bold"><Icon name="pen" className="h-4 w-4" />Signing paperwork</h2>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Send the form from DocuSign with <b>Open DocuSign</b>. For anyone under 18, the parent or guardian signs.</li>
                <li>When it comes back signed, download the PDF and the completion certificate.</li>
                <li>Upload both to the Playground Scholarship folder.</li>
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function byDue(a: Row, b: Row) {
  return (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1;
}
