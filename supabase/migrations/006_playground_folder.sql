-- Adds the "Playground Scholarship" documents folder.
-- Visible to admins and committee members (not viewers), like Spotlight and Mentoring,
-- since scholarship files can include applicant and family details.
-- Safe to run more than once.

alter table public.documents drop constraint if exists documents_folder_check;
alter table public.documents add constraint documents_folder_check check (folder in (
  'committee', 'plans', 'spotlight', 'releases', 'mentoring', 'safeguarding', 'screening', 'partners',
  'grants', 'florida', 'showcases', 'marketing', 'templates', 'admin', 'unfiled', 'playground'));

create or replace function public.doc_folder_visible(f text)
returns boolean language sql stable as $$
  select case
    when f in ('releases', 'spotlight', 'mentoring', 'playground') then public.is_editor()
    when f in ('screening', 'admin') then public.my_role() = 'admin'
    else public.is_member()
  end;
$$;
grant execute on function public.doc_folder_visible(text) to authenticated;
