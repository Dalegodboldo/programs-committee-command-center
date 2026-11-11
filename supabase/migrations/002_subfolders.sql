-- Subfolders inside each document folder (migration 002).
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to re-run.
-- A subfolder is a path inside a top folder, like "Meeting 1/Agendas". It follows its top folder's access rules.

alter table public.documents add column if not exists subpath text not null default '';

create table if not exists public.doc_subfolders (
  id uuid primary key default gen_random_uuid(),
  folder text not null,
  path text not null check (path <> ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (folder, path)
);
alter table public.doc_subfolders enable row level security;

drop policy if exists doc_subfolders_select on public.doc_subfolders;
create policy doc_subfolders_select on public.doc_subfolders for select to authenticated
  using (public.doc_folder_visible(folder));
drop policy if exists doc_subfolders_write on public.doc_subfolders;
create policy doc_subfolders_write on public.doc_subfolders for all to authenticated
  using (public.is_editor() and public.doc_folder_visible(folder))
  with check (public.is_editor() and public.doc_folder_visible(folder));

revoke all on public.doc_subfolders from anon;
grant select, insert, update, delete on public.doc_subfolders to authenticated;

-- Rename a subfolder (and everything inside it) in one step. Runs with the caller's own access rules.
create or replace function public.rename_doc_subfolder(f text, old_path text, new_path text)
returns void language plpgsql as $$
begin
  if new_path is null or btrim(new_path) = '' then
    raise exception 'A folder needs a name';
  end if;
  update public.documents
     set subpath = new_path || substr(subpath, length(old_path) + 1)
   where folder = f and (subpath = old_path or left(subpath, length(old_path) + 1) = old_path || '/');
  update public.doc_subfolders
     set path = new_path || substr(path, length(old_path) + 1)
   where folder = f and (path = old_path or left(path, length(old_path) + 1) = old_path || '/');
  insert into public.doc_subfolders (folder, path) values (f, new_path) on conflict do nothing;
end;
$$;
revoke all on function public.rename_doc_subfolder(text, text, text) from public, anon;
grant execute on function public.rename_doc_subfolder(text, text, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'doc_subfolders') then
    alter publication supabase_realtime add table public.doc_subfolders;
  end if;
end $$;
