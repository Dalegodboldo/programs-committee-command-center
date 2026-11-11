-- AITCF Programs Committee Command Center
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all of it > Run.
-- Safe to re-run: it drops and recreates policies and triggers, and only adds starting rows to empty tables.

-------------------------------------------------------------------------------
-- 1. People and roles
-------------------------------------------------------------------------------
-- admin  = AITCF staff who run the dashboard (everything, including access)
-- member = Programs Committee members (edit the working records)
-- viewer = read-only (board members, advisors); never sees mentee, family or artist contact records
-- A new login has no role, and so sees nothing, until an admin assigns one.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text constraint profiles_role_check check (role in ('admin', 'member', 'viewer')),
  request_note text,
  declined boolean not null default false,
  requested_at timestamptz default now(),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, request_note)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    left(new.raw_user_meta_data ->> 'request_note', 1000)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_member()
returns boolean language sql stable as $$
  select public.my_role() in ('admin', 'member', 'viewer');
$$;

create or replace function public.is_editor()
returns boolean language sql stable as $$
  select public.my_role() in ('admin', 'member');
$$;

create or replace function public.request_access_again(note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set declined = false,
         requested_at = now(),
         request_note = coalesce(nullif(left(note, 1000), ''), request_note)
   where id = auth.uid() and role is null and declined = true;
  return found;
end;
$$;
revoke all on function public.request_access_again(text) from public, anon;
grant execute on function public.request_access_again(text) to authenticated;

-------------------------------------------------------------------------------
-- 2. Committee tables
-------------------------------------------------------------------------------

-- Monthly committee meetings
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Programs Committee meeting',
  meeting_date date,
  status text not null default 'planned' check (status in ('planned', 'held', 'cancelled')),
  attendees text,
  agenda text,
  recap_link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Action items
create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner text,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'blocked', 'done')),
  workstream text,
  proposed boolean not null default false,
  meeting_id uuid references public.meetings (id) on delete set null,
  notes text,
  done_on date,
  sort_order int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Decisions the committee has made
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  decided_on date,
  meeting_id uuid references public.meetings (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revisit', 'superseded')),
  sort_order int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Questions waiting on a decision
create table if not exists public.open_questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  owner text,
  decide_by date,
  status text not null default 'open' check (status in ('open', 'decided', 'parked')),
  resolution text,
  meeting_id uuid references public.meetings (id) on delete set null,
  sort_order int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Goals: the December scorecard, the Spotlight roadmap gates and first-year targets
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'scorecard' check (category in ('scorecard', 'roadmap', 'target')),
  target_date date,
  target_value numeric,
  current_value numeric,
  gate text,
  done boolean not null default false,
  notes text,
  sort_order int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spotlight roster (internal: full names stay here; public posts use first names only)
create table if not exists public.spotlight_artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discipline text,
  handle text,
  age_status text not null default 'unknown' check (age_status in ('unknown', 'minor', 'adult')),
  guardian_name text,
  guardian_contact text,
  outreach_status text not null default 'identified' check (outreach_status in (
    'identified', 'following', 'messaged', 'release_sent', 'release_signed', 'featured', 'declined', 'skip')),
  release_signed_on date,
  featured_on date,
  mentoring_offered boolean not null default false,
  showcase_invite boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spotlight content calendar
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  post_date date,
  format text not null default 'spotlight' check (format in ('spotlight', 'mentor_moment', 'open_call', 'behind_the_work', 'then_and_now', 'other')),
  artist_id uuid references public.spotlight_artists (id) on delete set null,
  status text not null default 'idea' check (status in ('idea', 'drafted', 'approved', 'scheduled', 'posted')),
  channels text default 'Instagram, website, email',
  caption text,
  link text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mentors
create table if not exists public.mentors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  disciplines text,
  location text,
  background_check text not null default 'not_started' check (background_check in ('not_started', 'requested', 'on_file', 'expired')),
  background_check_date date,
  school_level2 boolean not null default false,
  code_of_conduct boolean not null default false,
  capacity int,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mentees (private: admins and committee members only)
create table if not exists public.mentees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discipline text,
  age_status text not null default 'unknown' check (age_status in ('unknown', 'minor', 'adult')),
  source text,
  guardian_name text,
  guardian_contact text,
  stage text not null default 'inquiry' check (stage in (
    'inquiry', 'intake', 'prescreen', 'matched', 'active', 'showcase', 'ambassador', 'closed')),
  point_mentor_id uuid references public.mentors (id) on delete set null,
  inquiry_date date default current_date,
  intake_date date,
  match_date date,
  outcome text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mentoring sessions (every session has two adults present)
create table if not exists public.mentoring_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date default current_date,
  mentee_id uuid references public.mentees (id) on delete cascade,
  mentor_id uuid references public.mentors (id) on delete set null,
  format text not null default 'zoom' check (format in ('zoom', 'in_person', 'phone')),
  second_adult text,
  minutes int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partners: schools, community groups, venues, music and arts organizations, funders
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text,
  region text,
  owner text,
  status text not null default 'to_approach' check (status in (
    'to_approach', 'contacted', 'meeting_set', 'in_talks', 'committed', 'active', 'paused', 'declined')),
  contact_name text,
  contact_email text,
  next_step text,
  next_step_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Grants
create table if not exists public.grants (
  id uuid primary key default gen_random_uuid(),
  funder text not null,
  program text,
  region text,
  amount numeric,
  deadline date,
  status text not null default 'researching' check (status in (
    'researching', 'writing', 'submitted', 'awarded', 'declined', 'reporting', 'closed')),
  owner text,
  link text,
  report_due date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Florida provider classes (listing in the state provider portal)
create table if not exists public.provider_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mentor text,
  synopsis text,
  delivery text not null default 'live' check (delivery in ('live', 'recorded', 'both')),
  frequency text,
  price numeric,
  status text not null default 'idea' check (status in ('idea', 'synopsis_sent', 'syllabus_drafted', 'approved', 'listed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Documents (files live in the private 'documents' storage bucket)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  folder text not null default 'unfiled' check (folder in (
    'committee', 'plans', 'spotlight', 'releases', 'mentoring', 'safeguarding', 'screening', 'partners',
    'grants', 'florida', 'showcases', 'marketing', 'templates', 'admin', 'unfiled')),
  storage_path text not null unique,
  size_bytes bigint,
  doc_year int default extract(year from now())::int,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  meeting_id uuid references public.meetings (id) on delete set null,
  partner_id uuid references public.partners (id) on delete set null,
  grant_id uuid references public.grants (id) on delete set null,
  artist_id uuid references public.spotlight_artists (id) on delete set null,
  mentee_id uuid references public.mentees (id) on delete set null,
  mentor_id uuid references public.mentors (id) on delete set null,
  class_id uuid references public.provider_classes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who changed what, written automatically
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid,
  action text not null,
  actor uuid,
  actor_name text,
  summary text,
  created_at timestamptz not null default now()
);

-- Ask Claude: text pulled out of PDFs, Word files etc., so it can search inside them
create table if not exists public.document_text (
  document_id uuid primary key references public.documents (id) on delete cascade,
  content text not null default '',
  extracted_at timestamptz not null default now()
);

-- Ask Claude: one row per question, for the daily limit and usage
create table if not exists public.assistant_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- 3. Triggers: timestamps, done dates, activity log
-------------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.stamp_done()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.done_on := coalesce(new.done_on, current_date);
  elsif new.status <> 'done' then
    new.done_on := null;
  end if;
  return new;
end;
$$;

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  label text;
  who text;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  -- Private records log only that something changed, never names.
  if tg_table_name in ('mentees', 'mentoring_sessions', 'spotlight_artists') then
    label := '';
  else
    label := coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'funder', '');
  end if;
  select coalesce(full_name, email) into who from public.profiles where id = auth.uid();
  insert into public.activity_log (table_name, row_id, action, actor, actor_name, summary)
  values (tg_table_name, (rec ->> 'id')::uuid, lower(tg_op), auth.uid(), who, left(label, 200));
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['meetings', 'action_items', 'decisions', 'open_questions', 'goals', 'spotlight_artists',
                           'content_posts', 'mentors', 'mentees', 'mentoring_sessions', 'partners', 'grants',
                           'provider_classes', 'documents'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
    execute format('drop trigger if exists log_%1$s on public.%1$s', t);
    execute format('create trigger log_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.log_activity()', t);
  end loop;
end $$;

drop trigger if exists stamp_done_action_items on public.action_items;
create trigger stamp_done_action_items before insert or update on public.action_items
  for each row execute function public.stamp_done();

-------------------------------------------------------------------------------
-- 4. Row-level security (the database enforces who can see and edit what)
-------------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles', 'meetings', 'action_items', 'decisions', 'open_questions', 'goals',
                           'spotlight_artists', 'content_posts', 'mentors', 'mentees', 'mentoring_sessions',
                           'partners', 'grants', 'provider_classes', 'documents', 'activity_log',
                           'document_text', 'assistant_usage'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles: the team sees the team; only admins change names and roles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_member() or id = auth.uid());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Shared working tables: everyone on the team reads; admins and members edit
do $$
declare t text;
begin
  foreach t in array array['meetings', 'action_items', 'decisions', 'open_questions', 'goals', 'content_posts',
                           'mentors', 'partners', 'grants', 'provider_classes'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_member())', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.is_editor()) with check (public.is_editor())', t);
  end loop;
end $$;

-- Private tables (minors and family contacts): admins and members only, viewers never
do $$
declare t text;
begin
  foreach t in array array['spotlight_artists', 'mentees', 'mentoring_sessions'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_editor())', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.is_editor()) with check (public.is_editor())', t);
  end loop;
end $$;

-- Documents: who sees each folder
--   releases, spotlight, mentoring = admins and members
--   screening (background check reports), admin = admins only
--   everything else = the whole team, viewers included
create or replace function public.doc_folder_visible(f text)
returns boolean language sql stable as $$
  select case
    when f in ('releases', 'spotlight', 'mentoring') then public.is_editor()
    when f in ('screening', 'admin') then public.my_role() = 'admin'
    else public.is_member()
  end;
$$;
grant execute on function public.doc_folder_visible(text) to authenticated;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated
  using (public.doc_folder_visible(folder));
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (public.is_editor() and uploaded_by = auth.uid() and (folder not in ('screening', 'admin') or public.my_role() = 'admin'));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
  using (public.my_role() = 'admin' or (public.is_editor() and public.doc_folder_visible(folder)))
  with check ((public.my_role() = 'admin' or public.is_editor())
              and (folder not in ('screening', 'admin') or public.my_role() = 'admin'));
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated
  using (public.my_role() = 'admin' or (uploaded_by = auth.uid() and public.is_editor()));

-- Text pulled from files follows the same folder rules
drop policy if exists document_text_select on public.document_text;
create policy document_text_select on public.document_text for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id));
drop policy if exists document_text_write on public.document_text;
create policy document_text_write on public.document_text for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

drop policy if exists assistant_usage_select on public.assistant_usage;
create policy assistant_usage_select on public.assistant_usage for select to authenticated
  using (user_id = auth.uid() or public.my_role() = 'admin');
drop policy if exists assistant_usage_insert on public.assistant_usage;
create policy assistant_usage_insert on public.assistant_usage for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

-- Activity log: read-only for the team (rows come from triggers)
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated using (public.is_member());

-- Table access for signed-in users only (row-level security above still decides which rows).
do $$
declare t text;
begin
  foreach t in array array['profiles', 'meetings', 'action_items', 'decisions', 'open_questions', 'goals',
                           'spotlight_artists', 'content_posts', 'mentors', 'mentees', 'mentoring_sessions',
                           'partners', 'grants', 'provider_classes', 'documents', 'activity_log',
                           'document_text', 'assistant_usage'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
grant usage on schema public to authenticated;
grant execute on function public.my_role(), public.is_member(), public.is_editor() to authenticated;

-------------------------------------------------------------------------------
-- 5. File storage
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "pc docs read" on storage.objects;
create policy "pc docs read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member()
         and exists (select 1 from public.documents d where d.storage_path = storage.objects.name));
drop policy if exists "pc docs upload" on storage.objects;
create policy "pc docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_editor());
drop policy if exists "pc docs delete" on storage.objects;
create policy "pc docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (public.my_role() = 'admin' or owner_id = auth.uid()::text));

-------------------------------------------------------------------------------
-- 6. Live updates
-------------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles', 'meetings', 'action_items', 'decisions', 'open_questions', 'goals',
                           'spotlight_artists', 'content_posts', 'mentors', 'mentees', 'mentoring_sessions',
                           'partners', 'grants', 'provider_classes', 'documents', 'activity_log'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-------------------------------------------------------------------------------
-- 7. Starting data from Meeting 1 (November 10, 2026). Only added when the tables are empty.
-------------------------------------------------------------------------------

insert into public.meetings (title, meeting_date, status, attendees, agenda, notes)
select * from (values
  ('Meeting 1: program kickoff', date '2026-11-10', 'held',
   'Dale Eugene, Chasen Hampton, Tony Lucca, Patty Adams, Bret Iwan, Jenn Kramer, Gloria Ayee',
   'Program model and Nashville office; mentee intake and mentor screening; social spotlights and showcases; age range and OCSA; grants; Florida provider status; meeting cadence',
   'Recorded in two parts. Full recap and cheat sheet are in Documents > Committee Meetings.'),
  ('Meeting 2', date '2026-12-08', 'planned', null,
   'Progress on action items; decide age range, free versus paid, and the other open questions; Florida provider update',
   'Date to confirm. Same time slot as Meeting 1.')
) as v(title, meeting_date, status, attendees, agenda, notes)
where not exists (select 1 from public.meetings);

insert into public.action_items (title, owner, due_date, status, workstream, proposed, sort_order, meeting_id)
select v.title, v.owner, v.due_date, v.status, v.workstream, v.proposed, v.sort_order,
       (select id from public.meetings where meeting_date = date '2026-11-10' limit 1)
from (values
  ('Circulate the recap and set up a committee group text', 'Dale Eugene', date '2026-11-13', 'not_started', 'Committee', false, 10),
  ('Send the December meeting invite and update the email list (Patty''s Disney address)', 'Dale Eugene', date '2026-11-17', 'not_started', 'Committee', false, 20),
  ('Review the OCSA mentor guidelines Patty forwarded', 'Dale Eugene', date '2026-11-17', 'not_started', 'Partnerships', false, 30),
  ('Meet Casey (Jenn''s compliance director) with Chasen to start the Florida provider application', 'Dale Eugene', date '2026-11-24', 'not_started', 'Florida provider', false, 40),
  ('Get written confirmation of mentor background checks and the screening provider''s name', 'Dale Eugene', date '2026-11-24', 'not_started', 'Safeguarding', false, 50),
  ('Meet Mary Hewitt at the Los Angeles Boys and Girls Club', 'Dale Eugene', date '2026-12-01', 'not_started', 'Partnerships', false, 60),
  ('Draft a one-page ambassador concept', 'Dale Eugene', date '2026-12-01', 'not_started', 'Ambassadors', false, 70),
  ('Invite two or three former students to be the first ambassadors', 'Dale Eugene', date '2026-12-01', 'not_started', 'Ambassadors', false, 80),
  ('Send the committee the young artists list with links', 'Chasen Hampton', date '2026-11-17', 'not_started', 'Spotlight', false, 90),
  ('Build the Spotlight post format and collab-post template, with Dale', 'Chasen Hampton', date '2026-12-01', 'not_started', 'Spotlight', false, 100),
  ('Discovery call with the prospective Broadway mentee and her mom; send the intake form', 'Tony Lucca', date '2026-11-24', 'not_started', 'Mentoring', false, 110),
  ('Define the role Jozef Lukey could take in Nashville', 'Tony Lucca', date '2026-12-08', 'not_started', 'Nashville', false, 120),
  ('Send the OCSA mentorship program info to Dale', 'Patty Adams', date '2026-11-13', 'done', 'Partnerships', false, 130),
  ('Set a meeting with the OCSA mentorship program director, with Dale', 'Patty Adams', date '2026-12-01', 'not_started', 'Partnerships', false, 140),
  ('Talk with Celebworks about convention representation, then introduce Dale', 'Bret Iwan', date '2026-12-01', 'not_started', 'Other', false, 150),
  ('Finish the email intro connecting Dale and Chasen with Casey', 'Jenn Kramer', date '2026-11-13', 'in_progress', 'Florida provider', false, 160),
  ('Connect Dale with Mary Hewitt at the Los Angeles Boys and Girls Club', 'Jenn Kramer', date '2026-11-17', 'not_started', 'Partnerships', false, 170),
  ('Share the Florida school list (public, charter and private)', 'Jenn Kramer', date '2026-12-01', 'not_started', 'Partnerships', false, 180),
  ('Build local outreach lists (Boys and Girls Clubs, Big Brothers Big Sisters) once members send their areas', 'Jenn Kramer', date '2026-12-01', 'not_started', 'Partnerships', false, 190),
  ('Write proposals for the Florida and California mentorship grants and apply', 'Jenn Kramer', date '2026-12-08', 'not_started', 'Grants', false, 200),
  ('Draft class syllabi matched to Florida standards once mentors send synopses', 'Jenn Kramer', date '2026-12-08', 'not_started', 'Florida provider', false, 210),
  ('Draft an outreach email to university community engagement offices', 'Gloria Ayee', date '2026-12-01', 'not_started', 'Partnerships', true, 220),
  ('Text Jenn your local area for outreach lists', 'All members', date '2026-11-17', 'not_started', 'Partnerships', false, 230),
  ('Send Jenn a short synopsis of one class you''d want to teach', 'All members', date '2026-11-24', 'not_started', 'Florida provider', false, 240),
  ('Follow the artists on Chasen''s list and try one collab post through Always In The Club', 'All members', date '2026-12-08', 'not_started', 'Spotlight', false, 250)
) as v(title, owner, due_date, status, workstream, proposed, sort_order)
where not exists (select 1 from public.action_items);

insert into public.decisions (title, details, decided_on, sort_order, meeting_id)
select v.title, v.details, date '2026-11-10', v.sort_order,
       (select id from public.meetings where meeting_date = date '2026-11-10' limit 1)
from (values
  ('Mentoring leads', 'Free mentoring is the program to build first. Paid coaching follows once people see the mentoring.', 10),
  ('A team of mentors', 'Each mentee gets one point mentor plus access to the whole group, matched by skill.', 20),
  ('Everyone goes through intake', 'Intake form plus Dale''s pre-screen call with a parent before any match. No side matches.', 30),
  ('Ages 14 and up', 'Working minimum age is 14, through college age. To confirm in December.', 40),
  ('Safety comes first', 'All mentors are background checked under the bylaws. Outreach to families leads with it.', 50),
  ('Florida first', 'Pursue Florida provider status through the Orlando office''s certificate of use. Arizona later.', 60),
  ('Be selective', 'Focus on young performers already doing the work on stage.', 70),
  ('Build an ambassador track', 'Graduates spread the word and bring in new mentees.', 80),
  ('Community before fundraising', 'Public messaging leads with the creative community. No fundraising language up front.', 90),
  ('Meet monthly', 'Same time slot each month, email in between.', 100)
) as v(title, details, sort_order)
where not exists (select 1 from public.decisions);

insert into public.open_questions (title, details, decide_by, sort_order)
select * from (values
  ('Age range', 'Working floor is 14. OCSA starts in seventh grade; the Nashville brief says 14 to 25. One range for every site, or younger with partners and extra safeguards?', date '2026-12-08', 10),
  ('Free versus paid', 'Mentoring is free. Coaching is paid, and Florida provider classes would carry a price. Which offerings charge, and do scholarship funds cover them?', date '2026-12-08', 20),
  ('Roster gaps', 'Spotlight covers visual artists, performers and voice-over talent, but the roster is mostly musicians. Who sources the rest, and which voice-over partner first?', date '2026-12-08', 30),
  ('What a mentee leaves with', 'Adopt the Nashville track outcomes (a written plan, audition-ready material, a reel piece) program-wide?', date '2026-12-08', 40),
  ('Mentor capacity and matching', 'How many mentees can each mentor take, and does Dale assign every match?', date '2026-12-08', 50),
  ('Screening standard', 'Is the current background check enough, or do all mentors re-screen to the Level 2 standard schools require?', date '2026-12-08', 60),
  ('Florida details', 'Confirm the scholarship program''s official name, award amounts, provider rules and screening with Casey. Pick the first classes and prices.', date '2026-12-08', 70),
  ('Who runs the pipeline', 'Who does day-to-day outreach, booking and scheduling, and where are they based?', date '2026-12-08', 80)
) as v(title, details, decide_by, sort_order)
where not exists (select 1 from public.open_questions);

insert into public.goals (title, category, target_date, target_value, current_value, gate, done, sort_order)
select * from (values
  ('Florida provider application started', 'scorecard', date '2026-12-08', null::numeric, null::numeric, null, false, 10),
  ('Class ideas sent to Jenn', 'scorecard', date '2026-12-08', 2, 0, null, false, 20),
  ('Safety documents drafted and shared (release, code of conduct, two-adult rule)', 'scorecard', date '2026-12-08', null, null, null, false, 30),
  ('One mentee through intake and matched', 'scorecard', date '2026-12-08', 1, 0, null, false, 40),
  ('Partner meetings held (OCSA, LA Boys and Girls Club)', 'scorecard', date '2026-12-08', 2, 0, null, false, 50),
  ('Grant proposals submitted', 'scorecard', date '2026-12-08', 1, 0, null, false, 60),
  ('Signed media releases', 'scorecard', date '2026-12-08', 5, 0, null, false, 70),
  ('Phase 1, Foundation (Nov to Dec 2026): follow roster accounts, add visual and voice-over talent, finalize release and code of conduct, first 10 guardian messages', 'roadmap', date '2026-12-31', null, null, 'Release form final; 5 signed releases', false, 110),
  ('Phase 2, Spotlight launch (Jan to Mar 2027): 3 posts a week, Spotlight page live, first email, first mentoring sessions', 'roadmap', date '2027-03-31', null, null, '12 straight weeks of posts; 5 artists in mentoring', false, 120),
  ('Phase 3, First showcases (Apr to Jun 2027): first virtual showcase, sponsor pitch built on Spotlight numbers', 'roadmap', date '2027-06-30', null, null, 'Sponsor or partner committed', false, 130),
  ('Phase 4, Live showcase (second half of 2027): Spotlight Live Nashville, the day after the Nashville Gala', 'roadmap', date '2027-10-31', null, null, 'Orlando 2028 and California showcases scoped', false, 140),
  ('Artists spotlighted', 'target', date '2027-10-31', 150, 0, null, false, 210),
  ('Artists mentored before Nashville', 'target', date '2027-10-31', 15, 0, null, false, 220),
  ('Industry guests at Spotlight Live Nashville', 'target', date '2027-10-31', 10, 0, null, false, 230),
  ('Showcase sponsors', 'target', date '2027-10-31', 1, 0, null, false, 240),
  ('Partners committed', 'target', date '2027-10-31', 3, 0, null, false, 250)
) as v(title, category, target_date, target_value, current_value, gate, done, sort_order)
where not exists (select 1 from public.goals);

insert into public.mentors (name, disciplines, location, background_check, notes)
select * from (values
  ('Dale Eugene', 'TV and on-camera auditions', 'Los Angeles', 'on_file', 'Point person for intake and pre-screen calls'),
  ('Chasen Hampton', 'Music, vocals, live performance', null, 'on_file', null),
  ('Tony Lucca', 'Music, songwriting, recording', 'Nashville', 'on_file', null),
  ('Patty Adams', 'Visual arts, portfolios, college applications', 'California', 'on_file', 'Five years mentoring at OCSA'),
  ('Bret Iwan', 'Voice-over, animation, visual art', 'California', 'on_file', null),
  ('Jenn Kramer', 'Musical theater', 'Florida', 'on_file', null),
  ('Dee Dee', 'Musical theater', null, 'requested', 'Has mentored two or three students. Confirm screening on file.')
) as v(name, disciplines, location, background_check, notes)
where not exists (select 1 from public.mentors);

insert into public.mentees (name, discipline, age_status, source, stage, inquiry_date, notes)
select 'Broadway prospect (Michigan)', 'Musical theater', 'minor', 'Referral', 'inquiry', date '2026-11-10',
       'Referred through Tony. Recently shared a stage with Sutton Foster at a statewide event. Route to Dee Dee or Jenn as the musical theater fit, Tony as point mentor.'
where not exists (select 1 from public.mentees);

insert into public.partners (name, kind, region, owner, status, next_step, next_step_date, notes)
select * from (values
  ('Orange County School of the Arts (OCSA)', 'School', 'California', 'Patty Adams', 'contacted', 'Meeting with the mentorship program director', date '2026-12-01', 'Grades 7 to 12. Year-end showcase at Segerstrom Center for the Arts. Possible ticket-share partnership.'),
  ('Los Angeles Boys and Girls Club (Mary Hewitt)', 'Community organization', 'California', 'Dale Eugene', 'to_approach', 'Jenn introduces Dale, then meet', date '2026-11-17', null),
  ('The Playground, Los Angeles', 'School', 'California', null, 'in_talks', null, null, 'Playground Fund scholarship in development (Nashville brief).'),
  ('Halifax Repertory Theatre Youth Academy', 'School', 'Central Florida', null, 'in_talks', null, null, 'Scholarship placement pipeline discussed (Nashville brief).'),
  ('National Museum of African American Music (NMAAM)', 'Museum or venue', 'Nashville', 'Tony Lucca', 'in_talks', null, null, 'Possible home for Nashville programs and Spotlight Live host.'),
  ('Nashville Area Chamber of Commerce', 'Community organization', 'Nashville', 'Tony Lucca', 'in_talks', null, null, 'Two meetings held. Belong membership recommended.'),
  ('W.O. Smith Music School', 'Music organization', 'Nashville', null, 'to_approach', null, null, 'Nashville talent and mentor pool for 2027.'),
  ('National YoungArts Foundation', 'Arts organization', 'National', null, 'to_approach', null, null, 'Ages 15 to 18 across ten disciplines.'),
  ('Scholastic Art & Writing Awards', 'Arts organization', 'National', null, 'to_approach', null, null, 'Visual artists for showcase exhibits.'),
  ('Voice-over partner (to identify)', 'Voice-over', 'National', null, 'to_approach', 'Pick a coaching studio, casting network or animation studio', null, null),
  ('Music Will', 'Music organization', 'National', null, 'to_approach', null, null, 'Formerly Little Kids Rock.'),
  ('School of Rock', 'Music organization', 'National', null, 'to_approach', null, null, null),
  ('Girls Rock Camp Alliance', 'Music organization', 'National', null, 'to_approach', null, null, 'Find member camps near Nashville and Orlando.'),
  ('Fender Play Foundation', 'Funder or sponsor', 'National', null, 'to_approach', null, null, 'In-kind instruments and lessons.'),
  ('Guitar Center Music Foundation', 'Funder or sponsor', 'National', null, 'to_approach', null, null, 'In-kind instrument grants.'),
  ('University community engagement offices', 'School', 'National', 'Gloria Ayee', 'to_approach', 'Draft the outreach email', date '2026-12-01', null)
) as v(name, kind, region, owner, status, next_step, next_step_date, notes)
where not exists (select 1 from public.partners);
