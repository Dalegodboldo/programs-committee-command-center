// The app's color coding. Same color, same meaning, on every page.
// Class names are written out in full so Tailwind keeps them.

export type Tone = { chip: string; dot: string; tile: string; bar: string };

const T = {
  slate: { chip: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', tile: 'bg-slate-100 text-slate-700', bar: 'bg-slate-500' },
  stone: { chip: 'bg-stone-100 text-stone-700', dot: 'bg-stone-400', tile: 'bg-stone-100 text-stone-700', bar: 'bg-stone-500' },
  blue: { chip: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', tile: 'bg-blue-50 text-blue-800', bar: 'bg-blue-600' },
  sky: { chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500', tile: 'bg-sky-50 text-sky-800', bar: 'bg-sky-600' },
  violet: { chip: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500', tile: 'bg-violet-50 text-violet-800', bar: 'bg-violet-600' },
  indigo: { chip: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500', tile: 'bg-indigo-50 text-indigo-800', bar: 'bg-indigo-600' },
  teal: { chip: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500', tile: 'bg-teal-50 text-teal-800', bar: 'bg-teal-600' },
  pink: { chip: 'bg-pink-100 text-pink-800', dot: 'bg-pink-500', tile: 'bg-pink-50 text-pink-800', bar: 'bg-pink-600' },
  green: { chip: 'bg-green-100 text-green-800', dot: 'bg-green-500', tile: 'bg-green-50 text-green-800', bar: 'bg-green-600' },
  orange: { chip: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', tile: 'bg-orange-50 text-orange-800', bar: 'bg-orange-600' },
  amber: { chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', tile: 'bg-amber-50 text-amber-800', bar: 'bg-amber-500' },
  yellow: { chip: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500', tile: 'bg-yellow-50 text-yellow-800', bar: 'bg-yellow-500' },
  lime: { chip: 'bg-lime-100 text-lime-800', dot: 'bg-lime-500', tile: 'bg-lime-50 text-lime-800', bar: 'bg-lime-600' },
  red: { chip: 'bg-red-100 text-red-800', dot: 'bg-red-500', tile: 'bg-red-50 text-red-800', bar: 'bg-red-600' },
} satisfies Record<string, Tone>;
export const TONES = T;

// Workstreams (action items)
export const WORKSTREAM_TONE: Record<string, Tone> = {
  Spotlight: T.pink, Mentoring: T.green, Safeguarding: T.indigo, 'Florida provider': T.orange, Partnerships: T.blue,
  Grants: T.teal, Ambassadors: T.violet, Showcases: T.yellow, Nashville: T.sky, 'Playground Scholarship': T.lime, Committee: T.slate, Other: T.stone,
};
export const workstreamTone = (w?: string | null) => WORKSTREAM_TONE[w ?? ''] ?? T.stone;

// Statuses across every list. Gray = not started, blue = moving, amber = in progress or waiting,
// green = done or good, red = blocked or declined, violet = later stages, slate = closed or set aside.
const STATUS: Record<string, Tone> = {};
const put = (tone: Tone, ...keys: string[]) => keys.forEach((k) => (STATUS[k] = tone));
put(T.slate, 'not_started', 'idea', 'identified', 'to_approach', 'researching', 'inquiry', 'unknown', 'planned');
put(T.blue, 'contacted', 'following', 'messaged', 'drafted', 'writing', 'intake', 'prescreen', 'meeting_set', 'requested', 'synopsis_sent', 'syllabus_drafted', 'adult');
put(T.amber, 'in_progress', 'in_talks', 'release_sent', 'scheduled', 'revisit', 'open', 'minor');
put(T.green, 'done', 'held', 'active', 'committed', 'awarded', 'release_signed', 'featured', 'posted', 'on_file', 'decided', 'matched', 'listed', 'approved');
put(T.red, 'blocked', 'cancelled', 'declined', 'expired');
put(T.violet, 'showcase', 'ambassador', 'submitted', 'reporting');
put(T.stone, 'superseded', 'closed', 'paused', 'skip', 'parked');
export const statusTone = (v?: string | null): Tone | undefined => (v ? STATUS[v] : undefined);
// Color for a select cell in a table: workstreams by name, statuses by value.
export const cellTone = (key: string, v?: string | null): Tone | undefined =>
  !v ? undefined : key === 'workstream' ? WORKSTREAM_TONE[v] : STATUS[v];

// Sections of the app (menu icons, page headers, Overview tiles)
export type SectionStyle = { icon: string; tile: string; soft: string };
export const SECTION: Record<string, SectionStyle> = {
  '/': { icon: 'home', tile: 'bg-brand-50 text-brand-700', soft: 'bg-brand-50 text-brand-700' },
  '/actions': { icon: 'check', tile: 'bg-blue-100 text-blue-700', soft: 'bg-blue-50 text-blue-800' },
  '/meetings': { icon: 'calendar', tile: 'bg-violet-100 text-violet-700', soft: 'bg-violet-50 text-violet-800' },
  '/plan': { icon: 'target', tile: 'bg-teal-100 text-teal-700', soft: 'bg-teal-50 text-teal-800' },
  '/spotlight': { icon: 'mic', tile: 'bg-pink-100 text-pink-700', soft: 'bg-pink-50 text-pink-800' },
  '/mentoring': { icon: 'users', tile: 'bg-green-100 text-green-700', soft: 'bg-green-50 text-green-800' },
  '/partners': { icon: 'briefcase', tile: 'bg-orange-100 text-orange-700', soft: 'bg-orange-50 text-orange-800' },
  '/documents': { icon: 'folder', tile: 'bg-amber-100 text-amber-700', soft: 'bg-amber-50 text-amber-800' },
  '/team': { icon: 'user', tile: 'bg-slate-200 text-slate-700', soft: 'bg-slate-200/70 text-slate-800' },
  '/design': { icon: 'palette', tile: 'bg-slate-100 text-slate-600', soft: 'bg-white text-slate-700 ring-1 ring-slate-200' },
  '/backup': { icon: 'download', tile: 'bg-slate-100 text-slate-600', soft: 'bg-white text-slate-700 ring-1 ring-slate-200' },
};
export const sectionStyle = (href: string) => SECTION[href] ?? SECTION['/design'];

// People: a steady color for each committee member's initials
const PERSON_COLOR: Record<string, string> = {
  Dale: 'bg-brand-700', Chasen: 'bg-pink-700', Tony: 'bg-green-700', Patty: 'bg-orange-700',
  Bret: 'bg-sky-700', Jenn: 'bg-teal-700', Gloria: 'bg-violet-700', All: 'bg-slate-600',
};
const SPARE = ['bg-indigo-700', 'bg-rose-700', 'bg-cyan-700', 'bg-amber-700', 'bg-emerald-700', 'bg-fuchsia-700'];
export function personColor(name?: string | null) {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  if (PERSON_COLOR[first]) return PERSON_COLOR[first];
  let h = 0;
  for (const c of name ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SPARE[h % SPARE.length];
}
export function initials(name?: string | null) {
  if (!name) return '?';
  if (name === 'All members') return 'All';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}
export const firstName = (name?: string | null) => (name === 'All members' ? 'Everyone' : (name ?? '').split(' ')[0]);

// Due dates: late red, today strong amber, this week soft amber, later gray, done green
export function dueInfo(due?: string | null, status?: string | null, todayIso?: string): { label: string; cls: string; rank: number } {
  if (status === 'done') return { label: 'Done', cls: 'bg-green-100 text-green-800', rank: 4 };
  if (!due) return { label: 'No date', cls: 'bg-slate-100 text-slate-600', rank: 3 };
  const t = todayIso ?? new Date().toISOString().slice(0, 10);
  const n = Math.round((new Date(due + 'T12:00:00').getTime() - new Date(t + 'T12:00:00').getTime()) / 86400000);
  const day = new Date(due + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (n < 0) return { label: n === -1 ? '1 day late' : `${-n} days late`, cls: 'bg-red-100 text-red-800', rank: 0 };
  if (n === 0) return { label: 'Due today', cls: 'bg-amber-300 text-amber-950', rank: 1 };
  if (n <= 7) return { label: n === 1 ? 'Tomorrow' : day, cls: 'bg-amber-100 text-amber-900', rank: 2 };
  return { label: day, cls: 'bg-slate-100 text-slate-600', rank: 3 };
}
