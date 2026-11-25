-- Weekly task email: an on/off switch per person (on by default).
-- People can switch their own email off; admins can switch anyone's.
-- Safe to run more than once.
alter table public.profiles add column if not exists weekly_email boolean not null default true;

-- Lets a person change only their own weekly email setting (nothing else on their profile).
create or replace function public.set_my_weekly_email(on_off boolean)
returns void language sql security definer set search_path = public as $$
  update public.profiles set weekly_email = on_off where id = auth.uid();
$$;
revoke all on function public.set_my_weekly_email(boolean) from public;
grant execute on function public.set_my_weekly_email(boolean) to authenticated;

notify pgrst, 'reload schema';
