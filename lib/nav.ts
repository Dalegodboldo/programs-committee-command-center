// The app's sections, used by the menu and the Overview page's shortcuts.
export const NAV_LINKS = [
  { href: '/', label: 'Overview', icon: '🏠', hint: 'Today at a glance' },
  { href: '/actions', label: 'Action items', icon: '✅', hint: 'Who does what, by when' },
  { href: '/meetings', label: 'Meetings & decisions', icon: '🗓️', hint: 'Meetings, decisions, open questions' },
  { href: '/plan', label: 'Plan & goals', icon: '🎯', hint: 'Scorecard, roadmap, operating rules' },
  { href: '/spotlight', label: 'Spotlight', icon: '🎤', hint: 'Roster and content calendar', editorsOnly: true },
  { href: '/mentoring', label: 'Mentoring', icon: '🤝', hint: 'Mentees, sessions, mentors' },
  { href: '/partners', label: 'Partners & funding', icon: '🏛️', hint: 'Partners, grants, Florida classes' },
  { href: '/documents', label: 'Documents', icon: '🗂️', hint: 'Files by folder' },
  { href: '/team', label: 'Team', icon: '👥', hint: 'Access and roles' },
  { href: '/backup', label: 'Backup', icon: '💾', hint: 'Export everything', adminOnly: true },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];
export function visibleLinks(role: string | null) {
  return NAV_LINKS.filter((l) => (!('adminOnly' in l) || role === 'admin') && (!('editorsOnly' in l) || role === 'admin' || role === 'member'));
}
