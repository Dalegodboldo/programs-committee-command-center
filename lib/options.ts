const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
export const labelOf = (list: { value: string; label: string }[], v: string | null | undefined) => list.find((o) => o.value === v)?.label ?? v ?? '';

// Committee members, used as owners. "All members" is for tasks everyone does.
export const PEOPLE = ['Dale Eugene', 'Chasen Hampton', 'Tony Lucca', 'Patty Adams', 'Bret Iwan', 'Jenn Kramer', 'Gloria Ayee', 'All members'];
export const OWNER = opts(PEOPLE.map((p) => [p, p] as [string, string]));

export const ACTION_STATUS = opts([['not_started', 'Not started'], ['in_progress', 'In progress'], ['blocked', 'Blocked'], ['done', 'Done']]);
export const WORKSTREAM = opts([
  ['Spotlight', 'Spotlight'], ['Mentoring', 'Mentoring'], ['Safeguarding', 'Safeguarding'], ['Florida provider', 'Florida provider'],
  ['Partnerships', 'Partnerships'], ['Grants', 'Grants'], ['Ambassadors', 'Ambassadors'], ['Showcases', 'Showcases'],
  ['Nashville', 'Nashville'], ['Committee', 'Committee'], ['Other', 'Other'],
]);

export const MEETING_STATUS = opts([['planned', 'Planned'], ['held', 'Held'], ['cancelled', 'Cancelled']]);
export const DECISION_STATUS = opts([['active', 'In effect'], ['revisit', 'To revisit'], ['superseded', 'Replaced']]);
export const QUESTION_STATUS = opts([['open', 'Open'], ['decided', 'Decided'], ['parked', 'Parked']]);

export const DISCIPLINE = opts([
  ['Vocals', 'Vocals'], ['Drums and percussion', 'Drums and percussion'], ['Guitar, bass and strings', 'Guitar, bass and strings'],
  ['Keys and horns', 'Keys and horns'], ['Band or family act', 'Band or family act'], ['Visual art', 'Visual art'],
  ['Voice-over', 'Voice-over'], ['Acting', 'Acting'], ['Musical theater', 'Musical theater'], ['Dance', 'Dance'], ['Other', 'Other'],
]);
export const AGE_STATUS = opts([['unknown', 'To check'], ['minor', 'Minor'], ['adult', 'Adult']]);
export const OUTREACH_STATUS = opts([
  ['identified', 'Identified'], ['following', 'Following'], ['messaged', 'Guardian messaged'], ['release_sent', 'Release sent'],
  ['release_signed', 'Release signed'], ['featured', 'Featured'], ['declined', 'Declined'], ['skip', 'Skip'],
]);
export const POST_FORMAT = opts([
  ['spotlight', 'The Spotlight (Mon)'], ['mentor_moment', 'Mentor Moment (Wed)'], ['open_call', 'Open Call Friday'],
  ['behind_the_work', 'Behind The Work'], ['then_and_now', 'Then & Now'], ['other', 'Other'],
]);
export const POST_STATUS = opts([['idea', 'Idea'], ['drafted', 'Drafted'], ['approved', 'Approved'], ['scheduled', 'Scheduled'], ['posted', 'Posted']]);

export const MENTEE_STAGE = opts([
  ['inquiry', 'Inquiry'], ['intake', 'Intake form'], ['prescreen', 'Pre-screen call'], ['matched', 'Matched'],
  ['active', 'Active'], ['showcase', 'Showcase'], ['ambassador', 'Ambassador'], ['closed', 'Closed'],
]);
export const MENTEE_SOURCE = opts([
  ['Social spotlight', 'Social spotlight'], ['School partner', 'School partner'], ['Community partner', 'Community partner'],
  ['Florida provider class', 'Florida provider class'], ['Ambassador', 'Ambassador'], ['Referral', 'Referral'], ['Other', 'Other'],
]);
export const SESSION_FORMAT = opts([['zoom', 'Zoom'], ['in_person', 'In person'], ['phone', 'Phone']]);
// Where AITCF runs mentor background checks.
export const CHECKR_URL = 'https://dashboard.checkr.com/home';

export const BACKGROUND_CHECK = opts([['not_started', 'Not started'], ['requested', 'Requested'], ['on_file', 'On file'], ['expired', 'Expired']]);

export const PARTNER_KIND = opts([
  ['School', 'School'], ['Community organization', 'Community organization'], ['Museum or venue', 'Museum or venue'],
  ['Music organization', 'Music organization'], ['Arts organization', 'Arts organization'], ['Voice-over', 'Voice-over'],
  ['Funder or sponsor', 'Funder or sponsor'], ['Industry', 'Industry'], ['Other', 'Other'],
]);
export const REGION = opts([
  ['California', 'California'], ['Central Florida', 'Central Florida'], ['Nashville', 'Nashville'], ['Arizona', 'Arizona'],
  ['National', 'National'], ['Other', 'Other'],
]);
export const PARTNER_STATUS = opts([
  ['to_approach', 'To approach'], ['contacted', 'Contacted'], ['meeting_set', 'Meeting set'], ['in_talks', 'In talks'],
  ['committed', 'Committed'], ['active', 'Active'], ['paused', 'Paused'], ['declined', 'Declined'],
]);
export const GRANT_STATUS = opts([
  ['researching', 'Researching'], ['writing', 'Writing'], ['submitted', 'Submitted'], ['awarded', 'Awarded'],
  ['declined', 'Declined'], ['reporting', 'Reporting'], ['closed', 'Closed out'],
]);
export const CLASS_DELIVERY = opts([['live', 'Live'], ['recorded', 'Recorded'], ['both', 'Live and recorded']]);
export const CLASS_STATUS = opts([
  ['idea', 'Idea'], ['synopsis_sent', 'Synopsis sent to Jenn'], ['syllabus_drafted', 'Syllabus drafted'], ['approved', 'Approved'], ['listed', 'Listed'],
]);

// Document folders. Access is enforced by the database (public.doc_folder_visible).
export const DOC_FOLDERS = [
  { value: 'committee', label: 'Committee Meetings', icon: '🗓️', hint: 'Agendas, recaps, cheat sheets, minutes', access: 'everyone' },
  { value: 'plans', label: 'Plans & Strategy', icon: '🧭', hint: 'Spotlight plan, Nashville strategy, program outline', access: 'everyone' },
  { value: 'spotlight', label: 'Spotlight', icon: '🎤', hint: 'Roster exports, post drafts, caption templates, clips', access: 'team' },
  { value: 'releases', label: 'Releases & Consent', icon: '✍️', hint: 'Signed media releases, guardian consent and medical forms', access: 'team' },
  { value: 'mentoring', label: 'Mentoring & Intake', icon: '🤝', hint: 'Intake forms, mentor guidelines, session notes', access: 'team' },
  { value: 'safeguarding', label: 'Safeguarding Policies', icon: '🛡️', hint: 'Code of conduct, two-adult rule, child safety policy', access: 'everyone' },
  { value: 'screening', label: 'Background Checks', icon: '🔐', hint: 'Mentor background check reports, downloaded from Checkr', access: 'admin' },
  { value: 'partners', label: 'Partners & Schools', icon: '🏫', hint: 'Partner agreements, MOUs, program info from schools', access: 'everyone' },
  { value: 'grants', label: 'Grants & Funding', icon: '🏛️', hint: 'Applications, award letters, grant reports, sponsor decks', access: 'everyone' },
  { value: 'florida', label: 'Florida Provider', icon: '🌴', hint: 'Provider application, certificate of use, class syllabi', access: 'everyone' },
  { value: 'showcases', label: 'Showcases & Events', icon: '🎭', hint: 'Spotlight Live plans, run of show, venue agreements', access: 'everyone' },
  { value: 'marketing', label: 'Marketing & Social', icon: '📣', hint: 'Logos, post templates, one-sheets, press', access: 'everyone' },
  { value: 'templates', label: 'Templates & Forms', icon: '📋', hint: 'Blank intake form, release form, outreach scripts', access: 'everyone' },
  { value: 'admin', label: 'Admin only', icon: '🔒', hint: 'Anything sensitive', access: 'admin' },
  { value: 'unfiled', label: 'Unfiled', icon: '📄', hint: 'Files waiting to be sorted', access: 'everyone' },
] as const;
export const ACCESS_LABEL: Record<string, string> = { everyone: 'Everyone, including viewers', team: 'Admins and committee members', admin: 'Admins only' };
export const folderLabel = (v: string) => DOC_FOLDERS.find((f) => f.value === v)?.label ?? v;

// Records a file can be attached to.
export const DOC_LINKS = [
  { field: 'meeting_id', label: 'Meeting', table: 'meetings', title: 'title', date: 'meeting_date', folder: 'committee' },
  { field: 'partner_id', label: 'Partner', table: 'partners', title: 'name', date: '', folder: 'partners' },
  { field: 'grant_id', label: 'Grant', table: 'grants', title: 'funder', date: 'deadline', folder: 'grants' },
  { field: 'class_id', label: 'Florida class', table: 'provider_classes', title: 'title', date: '', folder: 'florida' },
  { field: 'artist_id', label: 'Spotlight artist', table: 'spotlight_artists', title: 'name', date: '', folder: 'releases' },
  { field: 'mentee_id', label: 'Mentee', table: 'mentees', title: 'name', date: '', folder: 'mentoring' },
  { field: 'mentor_id', label: 'Mentor', table: 'mentors', title: 'name', date: '', folder: 'mentoring' },
] as const;
export type DocLinkField = (typeof DOC_LINKS)[number]['field'];
