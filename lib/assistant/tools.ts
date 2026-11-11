import type { SupabaseClient } from '@supabase/supabase-js';
import { getDocumentText } from './extract';

// ---------------------------------------------------------------------------
// What Ask Claude may read, and the only fields it may propose to change.
// Anything not listed here (people and roles, private mentee and artist records,
// documents, deletions, code, settings) is out of reach by design.
// ---------------------------------------------------------------------------

type TableSpec = { label: string; cols: string[]; order: string; search: string[] };

export const READ_TABLES: Record<string, TableSpec> = {
  action_items: { label: 'Action item', cols: ['id', 'title', 'owner', 'due_date', 'status', 'workstream', 'proposed', 'meeting_id', 'notes', 'done_on'], order: 'due_date', search: ['title', 'notes', 'owner'] },
  meetings: { label: 'Meeting', cols: ['id', 'title', 'meeting_date', 'status', 'attendees', 'agenda', 'recap_link', 'notes'], order: 'meeting_date', search: ['title', 'agenda', 'notes'] },
  decisions: { label: 'Decision', cols: ['id', 'title', 'details', 'decided_on', 'meeting_id', 'status'], order: 'decided_on', search: ['title', 'details'] },
  open_questions: { label: 'Open question', cols: ['id', 'title', 'details', 'owner', 'decide_by', 'status', 'resolution'], order: 'decide_by', search: ['title', 'details', 'resolution'] },
  goals: { label: 'Goal', cols: ['id', 'title', 'category', 'target_date', 'target_value', 'current_value', 'gate', 'done', 'notes'], order: 'sort_order', search: ['title', 'notes', 'gate'] },
  partners: { label: 'Partner', cols: ['id', 'name', 'kind', 'region', 'owner', 'status', 'contact_name', 'contact_email', 'next_step', 'next_step_date', 'notes'], order: 'name', search: ['name', 'next_step', 'notes', 'contact_name'] },
  grants: { label: 'Grant', cols: ['id', 'funder', 'program', 'region', 'amount', 'deadline', 'status', 'owner', 'link', 'report_due', 'notes'], order: 'deadline', search: ['funder', 'program', 'notes'] },
  provider_classes: { label: 'Florida class', cols: ['id', 'title', 'mentor', 'synopsis', 'delivery', 'frequency', 'price', 'status', 'notes'], order: 'created_at', search: ['title', 'synopsis', 'mentor', 'notes'] },
  mentors: { label: 'Mentor', cols: ['id', 'name', 'disciplines', 'location', 'background_check', 'background_check_date', 'school_level2', 'code_of_conduct', 'capacity', 'active', 'notes'], order: 'name', search: ['name', 'disciplines', 'notes'] },
  content_posts: { label: 'Spotlight post', cols: ['id', 'post_date', 'format', 'artist_id', 'status', 'channels', 'caption', 'link', 'notes'], order: 'post_date', search: ['caption', 'notes'] },
  spotlight_artists: { label: 'Spotlight artist', cols: ['id', 'name', 'discipline', 'handle', 'age_status', 'outreach_status', 'release_signed_on', 'featured_on', 'mentoring_offered', 'showcase_invite', 'notes'], order: 'name', search: ['name', 'handle', 'notes'] },
  mentees: { label: 'Mentee', cols: ['id', 'name', 'discipline', 'age_status', 'source', 'stage', 'point_mentor_id', 'inquiry_date', 'intake_date', 'match_date', 'outcome', 'notes'], order: 'inquiry_date', search: ['name', 'notes', 'outcome'] },
  mentoring_sessions: { label: 'Mentoring session', cols: ['id', 'session_date', 'mentee_id', 'mentor_id', 'format', 'second_adult', 'minutes', 'notes'], order: 'session_date', search: ['notes'] },
  documents: { label: 'Document', cols: ['id', 'name', 'folder', 'doc_year', 'size_bytes', 'meeting_id', 'partner_id', 'grant_id', 'class_id', 'created_at'], order: 'created_at', search: ['name', 'folder'] },
  activity_log: { label: 'Activity', cols: ['table_name', 'action', 'actor_name', 'summary', 'created_at'], order: 'created_at', search: ['summary', 'actor_name'] },
};

const PEOPLE = ['Dale Eugene', 'Chasen Hampton', 'Tony Lucca', 'Patty Adams', 'Bret Iwan', 'Jenn Kramer', 'Gloria Ayee', 'All members'];
const WORKSTREAMS = ['Spotlight', 'Mentoring', 'Safeguarding', 'Florida provider', 'Partnerships', 'Grants', 'Ambassadors', 'Showcases', 'Nashville', 'Committee', 'Other'];
const REGIONS = ['California', 'Central Florida', 'Nashville', 'Arizona', 'National', 'Other'];

export const EDITABLE: Record<string, { label: string; title: string; fields: Record<string, 'text' | 'date' | 'bool' | 'number' | string[]> }> = {
  action_items: {
    label: 'Action item',
    title: 'title',
    fields: { title: 'text', owner: PEOPLE, due_date: 'date', status: ['not_started', 'in_progress', 'blocked', 'done'], workstream: WORKSTREAMS, notes: 'text' },
  },
  meetings: {
    label: 'Meeting',
    title: 'title',
    fields: { title: 'text', meeting_date: 'date', status: ['planned', 'held', 'cancelled'], attendees: 'text', agenda: 'text', recap_link: 'text', notes: 'text' },
  },
  decisions: { label: 'Decision', title: 'title', fields: { title: 'text', details: 'text', decided_on: 'date', status: ['active', 'revisit', 'superseded'] } },
  open_questions: {
    label: 'Open question',
    title: 'title',
    fields: { title: 'text', details: 'text', owner: PEOPLE, decide_by: 'date', status: ['open', 'decided', 'parked'], resolution: 'text' },
  },
  goals: { label: 'Goal', title: 'title', fields: { current_value: 'number', done: 'bool', notes: 'text' } },
  partners: {
    label: 'Partner',
    title: 'name',
    fields: {
      name: 'text', owner: PEOPLE, region: REGIONS,
      status: ['to_approach', 'contacted', 'meeting_set', 'in_talks', 'committed', 'active', 'paused', 'declined'],
      contact_name: 'text', next_step: 'text', next_step_date: 'date', notes: 'text',
    },
  },
  grants: {
    label: 'Grant',
    title: 'funder',
    fields: {
      funder: 'text', program: 'text', region: REGIONS, deadline: 'date', report_due: 'date', owner: PEOPLE, link: 'text',
      status: ['researching', 'writing', 'submitted', 'awarded', 'declined', 'reporting', 'closed'], notes: 'text',
    },
  },
  provider_classes: {
    label: 'Florida class',
    title: 'title',
    fields: { title: 'text', mentor: 'text', synopsis: 'text', delivery: ['live', 'recorded', 'both'], frequency: 'text', status: ['idea', 'synopsis_sent', 'syllabus_drafted', 'approved', 'listed'], notes: 'text' },
  },
};
const CREATABLE = ['action_items', 'meetings', 'decisions', 'open_questions', 'partners', 'grants', 'provider_classes'];

// Checks a proposed change against the list above. Returns clean values or an error message.
export function validateChange(table: string, values: Record<string, unknown>, creating: boolean): { ok: true; values: Record<string, any> } | { ok: false; error: string } {
  const spec = EDITABLE[table];
  if (!spec) return { ok: false, error: `Ask Claude can't change ${table}.` };
  if (creating && !CREATABLE.includes(table)) return { ok: false, error: `Ask Claude can't add new ${spec.label.toLowerCase()}s.` };
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    const kind = spec.fields[k];
    if (!kind) return { ok: false, error: `Ask Claude can't change the "${k}" field.` };
    if (v === null || v === '') {
      if (k === spec.title) return { ok: false, error: `${k} can't be empty.` };
      out[k] = null;
    } else if (Array.isArray(kind)) {
      if (!kind.includes(String(v))) return { ok: false, error: `"${v}" isn't a valid ${k}. Options: ${kind.join(', ')}.` };
      out[k] = String(v);
    } else if (kind === 'bool') {
      out[k] = v === true || v === 'true';
    } else if (kind === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) return { ok: false, error: `${k} must be a number.` };
      out[k] = n;
    } else if (kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return { ok: false, error: `${k} must be a date like 2026-12-15.` };
      out[k] = String(v);
    } else {
      out[k] = String(v).slice(0, 4000);
    }
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'No changes given.' };
  return { ok: true, values: out };
}

export type Proposal = {
  kind: 'update' | 'create';
  table: string;
  id?: string;
  label: string;
  title: string;
  changes: { field: string; before?: any; after: any }[];
  values: Record<string, any>;
  reason?: string;
};

// ---------------------------------------------------------------------------
// Tool definitions sent to Claude
// ---------------------------------------------------------------------------

export function toolDefinitions(canEdit: boolean) {
  const tables = Object.keys(READ_TABLES);
  const tools: any[] = [
    {
      name: 'list_records',
      description:
        'Read rows from one area of the Command Center. Use for questions, summaries and reports. Tables: ' +
        Object.entries(READ_TABLES).map(([k, v]) => `${k} (${v.cols.join(', ')})`).join('; '),
      input_schema: {
        type: 'object',
        properties: {
          table: { type: 'string', enum: tables },
          search: { type: 'string', description: 'Optional keyword, matched against the main text fields.' },
          filters: { type: 'object', description: 'Optional exact-match filters, e.g. {"status": "not_started", "owner": "Dale Eugene"}.', additionalProperties: { type: ['string', 'boolean', 'number'] } },
          limit: { type: 'integer', minimum: 1, maximum: 200 },
        },
        required: ['table'],
      },
    },
    {
      name: 'search_documents',
      description: 'Search uploaded documents by file name and by the text inside them (PDF, Word, text files). Returns matching files with short excerpts.',
      input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
    {
      name: 'read_document',
      description: 'Read the text of one uploaded document by id. Long files come in parts; ask for the next part if needed.',
      input_schema: { type: 'object', properties: { id: { type: 'string' }, part: { type: 'integer', minimum: 1 } }, required: ['id'] },
    },
  ];
  if (canEdit) {
    tools.push(
      {
        name: 'propose_update',
        description:
          'Propose a small edit to one existing record. Nothing is saved until the user clicks Confirm. Allowed: ' +
          Object.entries(EDITABLE).map(([t, s]) => `${t}: ${Object.keys(s.fields).join(', ')}`).join('; ') +
          '. Dates are YYYY-MM-DD. Look up the record id with list_records first.',
        input_schema: {
          type: 'object',
          properties: {
            table: { type: 'string', enum: Object.keys(EDITABLE) },
            id: { type: 'string' },
            changes: { type: 'object', additionalProperties: true },
            reason: { type: 'string', description: 'One short line on why.' },
          },
          required: ['table', 'id', 'changes'],
        },
      },
      {
        name: 'propose_create',
        description: `Propose adding one new record to ${CREATABLE.join(', ')} (same allowed fields as propose_update). Nothing is saved until the user clicks Confirm.`,
        input_schema: {
          type: 'object',
          properties: { table: { type: 'string', enum: CREATABLE }, values: { type: 'object', additionalProperties: true }, reason: { type: 'string' } },
          required: ['table', 'values'],
        },
      },
    );
  }
  return tools;
}

// ---------------------------------------------------------------------------
// Running a tool. Every query goes through the signed-in person's own
// Supabase session, so the database's access rules still apply.
// ---------------------------------------------------------------------------

const PART = 40_000;
const clean = (s: string) => s.replace(/[,()*%\\:]/g, ' ').trim().slice(0, 100);

export async function runTool(
  name: string,
  input: any,
  ctx: { supabase: SupabaseClient; canEdit: boolean; proposals: Proposal[] },
): Promise<string> {
  const { supabase } = ctx;

  if (name === 'list_records') {
    const spec = READ_TABLES[input.table];
    if (!spec) return 'Unknown table.';
    let q = supabase.from(input.table).select(spec.cols.join(','));
    for (const [k, v] of Object.entries(input.filters ?? {})) {
      if (!spec.cols.includes(k)) return `Unknown field "${k}" for ${input.table}.`;
      q = q.eq(k, v as any);
    }
    const term = input.search ? clean(String(input.search)) : '';
    if (term) q = q.or(spec.search.map((c) => `${c}.ilike.*${term}*`).join(','));
    const desc = ['activity_log', 'documents', 'mentoring_sessions', 'decisions'].includes(input.table);
    q = q.order(spec.order, { ascending: !desc, nullsFirst: false }).limit(Math.min(Number(input.limit) || 100, 200));
    const { data, error } = await q;
    if (error) return `Error: ${error.message}`;
    return JSON.stringify({ table: input.table, count: data?.length ?? 0, rows: data });
  }

  if (name === 'search_documents') {
    const { data: docs, error } = await supabase.from('documents').select('id, name, folder, storage_path, created_at').order('created_at', { ascending: false });
    if (error) return `Error: ${error.message}`;
    const words = String(input.query ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const results: any[] = [];
    let unread = 0;
    const started = Date.now();
    for (const d of docs ?? []) {
      let text = '';
      try {
        // Keep searches quick: extract at most ~15 seconds' worth of uncached files per search.
        const { data: cached } = await supabase.from('document_text').select('content').eq('document_id', d.id).maybeSingle();
        if (cached) text = cached.content;
        else if (Date.now() - started < 15_000) text = await getDocumentText(supabase, d, ctx.canEdit);
        else unread++;
      } catch {
        unread++;
      }
      const hay = `${d.name} ${d.folder}\n${text}`.toLowerCase();
      const score = words.reduce((n, w) => n + (hay.split(w).length - 1) + (d.name.toLowerCase().includes(w) ? 5 : 0), 0);
      if (score === 0 && words.length) continue;
      const first = words.map((w) => text.toLowerCase().indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      const excerpt = first === undefined ? text.slice(0, 300) : text.slice(Math.max(0, first - 150), first + 350);
      results.push({ id: d.id, name: d.name, folder: d.folder, uploaded: d.created_at, score, has_text: text.length > 0, excerpt });
    }
    results.sort((a, b) => b.score - a.score);
    return JSON.stringify({ total_documents: docs?.length ?? 0, matches: results.slice(0, 8), not_yet_readable: unread });
  }

  if (name === 'read_document') {
    const { data: d, error } = await supabase.from('documents').select('id, name, folder, storage_path').eq('id', input.id).maybeSingle();
    if (error || !d) return 'Document not found.';
    let text: string;
    try {
      text = await getDocumentText(supabase, d, ctx.canEdit);
    } catch (e: any) {
      return `Could not read ${d.name}: ${e.message}`;
    }
    if (!text) return `${d.name} has no readable text (it may be an image, a scan or a spreadsheet).`;
    const parts = Math.ceil(text.length / PART);
    const part = Math.min(Math.max(Number(input.part) || 1, 1), parts);
    return JSON.stringify({ name: d.name, part, of_parts: parts, text: text.slice((part - 1) * PART, part * PART) });
  }

  if (name === 'propose_update' || name === 'propose_create') {
    if (!ctx.canEdit) return 'This person has read-only access, so no changes can be proposed.';
    const creating = name === 'propose_create';
    const table = String(input.table);
    const check = validateChange(table, creating ? input.values : input.changes, creating);
    if (!check.ok) return `Not allowed: ${check.error}`;
    const spec = EDITABLE[table];
    let before: Record<string, any> = {};
    if (!creating) {
      const { data: row } = await supabase.from(table).select(['id', spec.title, ...Object.keys(check.values)].join(',')).eq('id', input.id).maybeSingle();
      if (!row) return 'Record not found. Look up the id with list_records.';
      before = row as Record<string, any>;
    }
    ctx.proposals.push({
      kind: creating ? 'create' : 'update',
      table,
      id: creating ? undefined : String(input.id),
      label: spec.label,
      title: String(creating ? check.values[spec.title] ?? `New ${spec.label.toLowerCase()}` : before[spec.title]),
      changes: Object.entries(check.values).map(([field, after]) => ({ field, before: creating ? undefined : before[field], after })),
      values: check.values,
      reason: input.reason ? String(input.reason).slice(0, 300) : undefined,
    });
    return 'Proposal shown to the user with Confirm and Skip buttons. It is NOT saved yet; tell them to confirm it.';
  }

  return 'Unknown tool.';
}
