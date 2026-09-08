-- SUSTech Campus Events core schema.
-- All public tables are explicitly granted to the Data API and protected by RLS.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.school_personnel (
  id bigint generated always as identity primary key,
  full_name text not null check (length(btrim(full_name)) between 2 and 80),
  student_employee_id text not null unique check (length(btrim(student_employee_id)) between 4 and 32),
  email text not null unique check (email = lower(email) and email like '%@%'),
  department text,
  college_system text,
  role text not null check (role in ('student', 'faculty')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  personnel_id bigint not null unique references private.school_personnel(id),
  full_name text not null,
  department text,
  college_system text,
  role text not null check (role in ('student', 'faculty')),
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  title text not null check (length(btrim(title)) between 3 and 120),
  description text not null default '' check (length(description) <= 2000),
  location text not null check (length(btrim(location)) between 2 and 120),
  event_time timestamptz not null,
  max_attendees integer not null check (max_attendees between 1 and 5000),
  registered_count integer not null default 0,
  organizer_id uuid references public.profiles(id) on delete restrict,
  organizer_name text not null,
  organization text not null check (length(btrim(organization)) between 2 and 120),
  category text,
  college text,
  department text,
  college_system text,
  club text,
  status text not null default 'published' check (status in ('draft', 'published', 'cancelled')),
  source text not null default 'user' check (source in ('user', 'seed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_capacity_check check (registered_count between 0 and max_attendees),
  constraint events_source_organizer_check check (
    (source = 'seed' and organizer_id is null)
    or (source = 'user' and organizer_id is not null)
  )
);

create table public.registrations (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  registered_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index events_organizer_id_idx on public.events (organizer_id);
create index events_published_time_idx on public.events (event_time) where status = 'published';
create index registrations_user_id_idx on public.registrations (user_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  personnel private.school_personnel%rowtype;
begin
  select p.*
  into personnel
  from private.school_personnel as p
  where p.email = lower(new.email)
    and p.student_employee_id = new.raw_user_meta_data ->> 'student_employee_id'
    and p.full_name = new.raw_user_meta_data ->> 'full_name'
    and p.is_active;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Campus identity verification failed';
  end if;

  insert into public.profiles (
    id,
    personnel_id,
    full_name,
    department,
    college_system,
    role
  ) values (
    new.id,
    personnel.id,
    personnel.full_name,
    personnel.department,
    personnel.college_system,
    personnel.role
  );

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.prepare_event_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if new.source = 'seed' then
    if new.organizer_id is not null or length(btrim(new.organizer_name)) < 2 then
      raise exception 'Seed events require a display name and no organizer account';
    end if;
  else
    if caller_id is null or new.organizer_id is distinct from caller_id then
      raise exception 'Organizer must be the authenticated user';
    end if;

    select p.full_name
    into new.organizer_name
    from public.profiles as p
    where p.id = caller_id;

    if not found then
      raise exception 'Verified profile not found';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.prepare_event_write() from public, anon, authenticated;

create trigger prepare_event_before_write
before insert or update on public.events
for each row execute function private.prepare_event_write();

create or replace function public.register_for_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_event public.events%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select e.*
  into target_event
  from public.events as e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;
  if target_event.status <> 'published' then
    raise exception 'Event is not open for registration';
  end if;
  if target_event.event_time <= now() then
    raise exception 'Event has already started';
  end if;
  if target_event.organizer_id = caller_id then
    raise exception 'Organizers cannot register for their own event';
  end if;
  if target_event.registered_count >= target_event.max_attendees then
    raise exception 'Event is full';
  end if;

  insert into public.registrations (event_id, user_id)
  values (p_event_id, caller_id)
  on conflict do nothing;

  if not found then
    raise exception 'Already registered';
  end if;

  update public.events
  set registered_count = registered_count + 1
  where id = p_event_id;
end;
$$;

create or replace function public.cancel_event_registration(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  delete from public.registrations
  where event_id = p_event_id
    and user_id = caller_id;

  if not found then
    raise exception 'Registration not found';
  end if;

  update public.events
  set registered_count = greatest(registered_count - 1, 0)
  where id = p_event_id;
end;
$$;

revoke execute on function public.register_for_event(bigint) from public, anon;
revoke execute on function public.cancel_event_registration(bigint) from public, anon;
grant execute on function public.register_for_event(bigint) to authenticated;
grant execute on function public.cancel_event_registration(bigint) to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

create policy profiles_read_self
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy events_read_published_anon
on public.events for select
to anon
using (status = 'published');

create policy events_read_published_or_owned
on public.events for select
to authenticated
using (status = 'published' or organizer_id = (select auth.uid()));

create policy events_insert_owned
on public.events for insert
to authenticated
with check (
  organizer_id = (select auth.uid())
  and source = 'user'
);

create policy events_update_owned
on public.events for update
to authenticated
using (organizer_id = (select auth.uid()))
with check (
  organizer_id = (select auth.uid())
  and source = 'user'
);

create policy events_delete_owned
on public.events for delete
to authenticated
using (organizer_id = (select auth.uid()));

create policy registrations_read_related
on public.registrations for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.events as e
    where e.id = registrations.event_id
      and e.organizer_id = (select auth.uid())
  )
);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.registrations from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.events to anon, authenticated;
grant insert (
  title,
  description,
  location,
  event_time,
  max_attendees,
  organizer_id,
  organizer_name,
  organization,
  category,
  college,
  department,
  college_system,
  club,
  status,
  source
) on public.events to authenticated;
grant update (
  title,
  description,
  location,
  event_time,
  max_attendees,
  organization,
  category,
  college,
  department,
  college_system,
  club,
  status
) on public.events to authenticated;
grant delete on table public.events to authenticated;
grant select on table public.registrations to authenticated;
grant usage, select on sequence public.events_id_seq to authenticated;
