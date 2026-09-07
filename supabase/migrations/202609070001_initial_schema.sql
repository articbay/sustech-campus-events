create table public.school_personnel (
  id bigint generated always as identity primary key,
  full_name text not null,
  student_employee_id text unique not null,
  email text unique not null,
  department text,
  college_system text,
  role text not null check (role in ('学生', '教职工')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  personnel_id bigint unique not null references public.school_personnel(id),
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  location text,
  event_time timestamptz not null,
  max_attendees integer not null check (max_attendees > 0),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  organization text not null,
  category text,
  college text,
  department text,
  college_system text,
  club text,
  created_at timestamptz not null default now()
);

create table public.registrations (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index events_organizer_id_idx on public.events (organizer_id);
create index events_event_time_idx on public.events (event_time);
create index registrations_user_id_idx on public.registrations (user_id);
create index registrations_event_id_idx on public.registrations (event_id);

alter table public.school_personnel enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

revoke all on table public.school_personnel from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.registrations from anon, authenticated;

grant select on table public.events to anon, authenticated;
grant insert, update, delete on table public.events to authenticated;
grant select, insert, delete on table public.registrations to authenticated;
grant select on table public.profiles to authenticated;

create policy "events_are_publicly_readable"
on public.events for select to anon, authenticated using (true);

create policy "users_create_own_events"
on public.events for insert to authenticated
with check ((select auth.uid()) = organizer_id);

create policy "organizers_update_own_events"
on public.events for update to authenticated
using ((select auth.uid()) = organizer_id)
with check ((select auth.uid()) = organizer_id);

create policy "organizers_delete_own_events"
on public.events for delete to authenticated
using ((select auth.uid()) = organizer_id);

create policy "users_read_own_registrations"
on public.registrations for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users_create_own_registrations"
on public.registrations for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_delete_own_registrations"
on public.registrations for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "authenticated_users_read_profiles"
on public.profiles for select to authenticated using (true);
