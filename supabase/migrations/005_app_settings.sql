-- App design settings (migration 005): colors, names, welcome text, menu and Overview layout.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to re-run.
-- Everyone signed in reads them; only admins change them (on the Design page, or through Ask Claude after Confirm).

create table if not exists public.app_settings (
  id text primary key default 'site' check (id = 'site'),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values ('site') on conflict do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated using (public.is_member());
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

revoke all on public.app_settings from anon;
grant select, update on public.app_settings to authenticated;

drop trigger if exists touch_app_settings on public.app_settings;
create trigger touch_app_settings before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- Design changes show in Recent activity
create or replace function public.log_settings_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select coalesce(full_name, email) into who from public.profiles where id = auth.uid();
  insert into public.activity_log (table_name, row_id, action, actor, actor_name, summary)
  values ('app_settings', null, 'update', auth.uid(), who, 'App design');
  return null;
end;
$$;
drop trigger if exists log_app_settings on public.app_settings;
create trigger log_app_settings after update on public.app_settings
  for each row execute function public.log_settings_change();

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
