create table if not exists public.user_finance_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.user_finance_data enable row level security;

drop policy if exists "Users can read their own finance data" on public.user_finance_data;
create policy "Users can read their own finance data"
  on public.user_finance_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own finance data" on public.user_finance_data;
create policy "Users can create their own finance data"
  on public.user_finance_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own finance data" on public.user_finance_data;
create policy "Users can update their own finance data"
  on public.user_finance_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_finance_data from anon;
grant select, insert, update on public.user_finance_data to authenticated;

create table if not exists public.site_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_login_at timestamptz,
  last_seen_at timestamptz not null default now()
);

alter table public.site_presence enable row level security;
revoke all on public.site_presence from public, anon, authenticated;
grant all on public.site_presence to service_role;

create table if not exists public.admin_access_sessions (
  token_hash text primary key check (length(token_hash) = 64),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.admin_access_sessions enable row level security;
revoke all on public.admin_access_sessions from public, anon, authenticated;
grant all on public.admin_access_sessions to service_role;

create table if not exists public.admin_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_ip_created_idx
  on public.admin_login_attempts (ip_hash, created_at desc);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from public, anon, authenticated;
grant all on public.admin_login_attempts to service_role;
grant usage, select on sequence public.admin_login_attempts_id_seq to service_role;

create or replace function public.record_site_presence(p_user_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event is null or p_event not in ('login', 'heartbeat') then
    raise exception 'Invalid presence event';
  end if;

  insert into public.site_presence as existing_presence (user_id, last_login_at, last_seen_at)
  values (
    p_user_id,
    case when p_event = 'login' then now() else null end,
    now()
  )
  on conflict (user_id) do update
  set last_login_at = case
        when p_event = 'login' then now()
        else existing_presence.last_login_at
      end,
      last_seen_at = now();
end;
$$;

revoke all on function public.record_site_presence(uuid, text) from public, anon, authenticated;
grant execute on function public.record_site_presence(uuid, text) to service_role;

create or replace function public.admin_list_site_presence()
returns table (
  user_id uuid,
  email text,
  last_login_at timestamptz,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select presence.user_id, users.email::text, presence.last_login_at, presence.last_seen_at
  from public.site_presence as presence
  join auth.users as users on users.id = presence.user_id
  order by presence.last_seen_at desc;
$$;

revoke all on function public.admin_list_site_presence() from public, anon, authenticated;
grant execute on function public.admin_list_site_presence() to service_role;

notify pgrst, 'reload schema';
