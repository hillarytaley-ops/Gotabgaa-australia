-- Committee admin list for Onboard admins (invite by email)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard → SQL

create table if not exists public.site_admins (
  email text primary key,
  full_name text not null,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint site_admins_email_lower check (email = lower(email))
);

alter table public.site_admins
  add column if not exists invited_at timestamptz;

alter table public.site_admins enable row level security;

-- Browser clients can read the list; all writes go through the service-role API.
revoke insert, update, delete on table public.site_admins from public, anon, authenticated;
grant select on table public.site_admins to authenticated;

drop policy if exists "Authenticated can read site admins" on public.site_admins;
create policy "Authenticated can read site admins"
  on public.site_admins
  for select
  to authenticated
  using (true);

insert into public.site_admins (email, full_name)
values ('hillarytaley@gmail.com', 'Hillary Taley')
on conflict (email) do update
set full_name = excluded.full_name;

create or replace function public.protect_developer_site_admin()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and lower(coalesce(old.email, '')) = 'hillarytaley@gmail.com' then
    raise exception 'The developer account hillarytaley@gmail.com cannot be removed from the committee admin list.';
  end if;
  if tg_op = 'UPDATE'
     and lower(coalesce(old.email, '')) = 'hillarytaley@gmail.com'
     and lower(coalesce(new.email, '')) is distinct from 'hillarytaley@gmail.com' then
    raise exception 'The developer account hillarytaley@gmail.com cannot be renamed or removed from the committee admin list.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_developer_site_admin on public.site_admins;
create trigger trg_protect_developer_site_admin
before delete or update on public.site_admins
for each row
execute function public.protect_developer_site_admin();

comment on table public.site_admins is
  'Committee members invited to the leadership admin dashboard (Onboard admins)';
