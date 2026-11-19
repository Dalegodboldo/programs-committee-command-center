// App design settings: colors, names, welcome text, menu and Overview layout.
// Admins change them on the Design page or through Ask Claude (after Confirm).
// They live in one row of public.app_settings; nothing here touches code, access rules or data.

import { NAV_LINKS } from './nav';

export type Settings = {
  primary: string; // main color (sidebar highlights, buttons, dark panels). White text sits on it.
  accent: string; // highlight color (labels, progress, tags)
  appName: string;
  appSubtitle: string;
  welcome: string; // line under "Welcome, Name" on the Overview
  announcement: string; // optional banner at the top of the Overview ('' = none)
  navOrder: string[]; // menu order, by page address
  navHidden: string[]; // pages hidden from the menu
  navLabels: Record<string, string>; // renamed menu items
  overviewOrder: string[]; // Overview blocks, top to bottom
  overviewHidden: string[];
};

export const OVERVIEW_BLOCKS = [
  { key: 'meeting', label: 'Next meeting and December scorecard' },
  { key: 'stats', label: 'Numbers row (open, overdue, due soon, questions)' },
  { key: 'lists', label: 'My action items and Coming up' },
  { key: 'progress', label: 'Progress by workstream and Recent activity' },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  primary: '#1b2a4a',
  accent: '#e8a33d',
  appName: 'Programs Committee',
  appSubtitle: 'Command Center',
  welcome: 'Programs Committee Command Center. Everything here updates live.',
  announcement: '',
  navOrder: NAV_LINKS.map((l) => l.href),
  navHidden: [],
  navLabels: {},
  overviewOrder: OVERVIEW_BLOCKS.map((b) => b.key),
  overviewHidden: [],
};

// Pages that can never be hidden, so no one can lock themselves out of a fix.
export const ALWAYS_SHOWN = ['/', '/team', '/design'];

export const SETTING_LABELS: Record<keyof Settings, string> = {
  primary: 'Main color',
  accent: 'Highlight color',
  appName: 'App name',
  appSubtitle: 'App subtitle',
  welcome: 'Welcome line',
  announcement: 'Announcement banner',
  navOrder: 'Menu order',
  navHidden: 'Hidden menu items',
  navLabels: 'Menu names',
  overviewOrder: 'Overview order',
  overviewHidden: 'Hidden Overview blocks',
};

const HREFS: string[] = NAV_LINKS.map((l) => l.href);
const BLOCKS: string[] = OVERVIEW_BLOCKS.map((b) => b.key);
const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

// Fills gaps and drops anything unknown, so a stored row can never break the app.
export function normalize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' ? v.slice(0, max) : fallback);
  const order = (v: unknown, all: string[]) => {
    const list = Array.isArray(v) ? v.filter((x): x is string => all.includes(x)) : [];
    return [...new Set([...list, ...all])];
  };
  const subset = (v: unknown, all: string[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => all.includes(x)))] : []);
  const labels: Record<string, string> = {};
  if (r.navLabels && typeof r.navLabels === 'object') {
    for (const [k, v] of Object.entries(r.navLabels)) if (HREFS.includes(k) && typeof v === 'string' && v.trim()) labels[k] = v.trim().slice(0, 30);
  }
  return {
    primary: isHex(r.primary) ? r.primary!.toLowerCase() : d.primary,
    accent: isHex(r.accent) ? r.accent!.toLowerCase() : d.accent,
    appName: str(r.appName, d.appName, 40).trim() || d.appName,
    appSubtitle: str(r.appSubtitle, d.appSubtitle, 40),
    welcome: str(r.welcome, d.welcome, 200),
    announcement: str(r.announcement, d.announcement, 300),
    navOrder: order(r.navOrder, HREFS),
    navHidden: subset(r.navHidden, HREFS).filter((h) => !ALWAYS_SHOWN.includes(h)),
    navLabels: labels,
    overviewOrder: order(r.overviewOrder, BLOCKS),
    overviewHidden: subset(r.overviewHidden, BLOCKS),
  };
}

// Checks a partial change (from the Design page or Ask Claude) and explains anything it can't take.
export function validatePatch(patch: unknown): { ok: true; patch: Partial<Settings> } | { ok: false; error: string } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, error: 'No design changes given.' };
  const out: Partial<Settings> = {};
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    switch (k) {
      case 'primary':
      case 'accent': {
        if (!isHex(v)) return { ok: false, error: `${SETTING_LABELS[k]} must be a 6-digit hex color like #1b2a4a.` };
        const c = String(v).toLowerCase();
        if (k === 'primary' && contrast(toHex(mix(c, W, 0.1)), '#ffffff') < 4.5) return { ok: false, error: `${c} is too light for the main color: white text on it wouldn't be readable. Pick a darker shade.` };
        if (k === 'accent' && contrast(toHex(mix(c, B, 0.45)), '#ffffff') < 4.5) return { ok: false, error: `${c} is too pale for the highlight color: labels drawn from it wouldn't be readable. Pick a stronger shade.` };
        out[k] = c;
        break;
      }
      case 'appName':
      case 'appSubtitle':
      case 'welcome':
      case 'announcement': {
        if (typeof v !== 'string') return { ok: false, error: `${SETTING_LABELS[k]} must be text.` };
        const max = k === 'announcement' ? 300 : k === 'welcome' ? 200 : 40;
        if (v.length > max) return { ok: false, error: `${SETTING_LABELS[k]} can be at most ${max} characters.` };
        if (k === 'appName' && !v.trim()) return { ok: false, error: 'The app needs a name.' };
        out[k] = v.trim();
        break;
      }
      case 'navOrder':
      case 'overviewOrder': {
        const all = k === 'navOrder' ? HREFS : BLOCKS;
        if (!Array.isArray(v) || v.some((x) => !all.includes(x))) return { ok: false, error: `${SETTING_LABELS[k]} must list only: ${all.join(', ')}.` };
        out[k] = v as string[];
        break;
      }
      case 'navHidden': {
        if (!Array.isArray(v) || v.some((x) => !HREFS.includes(x))) return { ok: false, error: `Hidden menu items must be from: ${HREFS.join(', ')}.` };
        const locked = (v as string[]).filter((h) => ALWAYS_SHOWN.includes(h));
        if (locked.length) return { ok: false, error: `${locked.join(', ')} can't be hidden (Overview, Team and Design always stay in the menu).` };
        out.navHidden = v as string[];
        break;
      }
      case 'overviewHidden': {
        if (!Array.isArray(v) || v.some((x) => !BLOCKS.includes(x))) return { ok: false, error: `Hidden Overview blocks must be from: ${BLOCKS.join(', ')}.` };
        out.overviewHidden = v as string[];
        break;
      }
      case 'navLabels': {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'Menu names must be a map of page address to name.' };
        for (const [h, name] of Object.entries(v as Record<string, unknown>)) {
          if (!HREFS.includes(h)) return { ok: false, error: `"${h}" isn't a page. Pages: ${HREFS.join(', ')}.` };
          if (typeof name !== 'string' || name.length > 30) return { ok: false, error: 'Each menu name must be text, 30 characters at most (empty resets it).' };
        }
        out.navLabels = v as Record<string, string>;
        break;
      }
      default:
        return { ok: false, error: `"${k}" isn't a design setting. Settings: ${Object.keys(SETTING_LABELS).join(', ')}.` };
    }
  }
  if (!Object.keys(out).length) return { ok: false, error: 'No design changes given.' };
  return { ok: true, patch: out };
}

// Applies a checked change. Menu names merge (an empty name resets that item); everything else replaces.
export function applyPatch(current: Settings, patch: Partial<Settings>): Settings {
  const next: any = { ...current, ...patch };
  if (patch.navLabels) {
    const labels: Record<string, string> = { ...current.navLabels };
    for (const [h, name] of Object.entries(patch.navLabels)) {
      if (name.trim()) labels[h] = name.trim();
      else delete labels[h];
    }
    next.navLabels = labels;
  }
  return normalize(next);
}

// Menu links in the admin's chosen order, names and visibility.
export function arrangeLinks<T extends { href: string; label: string }>(links: readonly T[], s: Settings): T[] {
  const pos = (h: string) => { const i = s.navOrder.indexOf(h); return i < 0 ? 999 : i; };
  return [...links]
    .filter((l) => !s.navHidden.includes(l.href))
    .sort((a, b) => pos(a.href) - pos(b.href))
    .map((l) => (s.navLabels[l.href] ? { ...l, label: s.navLabels[l.href] } : l));
}

// ---- Colors -------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex: string, toward: [number, number, number], t: number): [number, number, number] {
  const c = rgb(hex);
  return c.map((v, i) => Math.round(v + (toward[i] - v) * t)) as [number, number, number];
}
const W: [number, number, number] = [255, 255, 255];
const B: [number, number, number] = [0, 0, 0];
const triple = (c: [number, number, number]) => c.join(' ');
const toHex = (c: [number, number, number]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// The shades the app's styles use, worked out from the two chosen colors.
export function cssVars(s: Settings): Record<string, string> {
  const p = s.primary;
  const a = s.accent;
  return {
    '--brand-50': triple(mix(p, W, 0.94)),
    '--brand-100': triple(mix(p, W, 0.86)),
    '--brand-500': triple(mix(p, W, 0.3)),
    '--brand-600': triple(mix(p, W, 0.1)),
    '--brand-700': triple(rgb(p)),
    '--brand-900': triple(mix(p, B, 0.45)),
    '--gold-50': triple(mix(a, W, 0.9)),
    '--gold-100': triple(mix(a, W, 0.8)),
    '--gold-400': triple(rgb(a)),
    '--gold-600': triple(mix(a, B, 0.22)),
    '--gold-800': triple(mix(a, B, 0.45)),
  };
}

export const cssVarsText = (s: Settings) => `:root{${Object.entries(cssVars(s)).map(([k, v]) => `${k}:${v}`).join(';')}}`;

// Plain-English value for a setting, used when showing a proposed change.
export function describeSetting(key: keyof Settings, value: unknown): string {
  const page = (h: string) => NAV_LINKS.find((l) => l.href === h)?.label ?? h;
  const block = (k: string) => OVERVIEW_BLOCKS.find((b) => b.key === k)?.label ?? k;
  if (key === 'navOrder' || key === 'navHidden') return (value as string[]).map(page).join(' · ') || 'none';
  if (key === 'overviewOrder' || key === 'overviewHidden') return (value as string[]).map(block).join(' · ') || 'none';
  if (key === 'navLabels') {
    const e = Object.entries(value as Record<string, string>);
    return e.length ? e.map(([h, n]) => `${page(h)} → ${n || '(default)'}`).join(', ') : 'default names';
  }
  return String(value ?? '') || '(empty)';
}

// A soft check on the pair: the highlight color is used for small labels on the main color.
export function pairWarning(s: Pick<Settings, 'primary' | 'accent'>): string | null {
  const r = contrast(s.accent, s.primary);
  return r < 3 ? `The highlight color is hard to read on the main color (contrast ${r.toFixed(1)}:1; aim for 3 or more). Try a lighter highlight or a darker main color.` : null;
}
