-- Frontdoor: initial schema.
--
-- One profile row per user and one row per opportunity. The columns the
-- Opportunities view sorts and filters on are real columns; the rest of an
-- opportunity (requirements, people, touches, stories, research, questions)
-- lives in `data` as jsonb, typed by web/lib/types.ts. Promote fields to
-- their own tables when something needs to query across them.

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  profile     jsonb   not null default '{}'::jsonb,
  templates   jsonb   not null default '[]'::jsonb,
  onboarded   boolean not null default false,
  cheered     text[]  not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.opportunities (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  company     text not null,
  role        text not null default '',
  location    text not null default '',
  open_phase  text not null default 'tailor'
              check (open_phase in ('upload', 'tailor', 'people', 'messaging', 'interview', 'track')),
  done_phases text[] not null default '{}',
  outcome     text not null default 'open'
              check (outcome in ('open', 'offer', 'hired', 'closed')),
  booked      boolean not null default false,
  example     boolean not null default false,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists opportunities_user_updated on public.opportunities (user_id, updated_at desc);

-- keep updated_at honest whatever the client sends
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists opportunities_touch on public.opportunities;
create trigger opportunities_touch before update on public.opportunities
  for each row execute function public.touch_updated_at();

-- Row-level security: every row belongs to exactly one user.
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;

create policy "profiles: owner reads"   on public.profiles for select using (auth.uid() = user_id);
create policy "profiles: owner inserts" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: owner updates" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles: owner deletes" on public.profiles for delete using (auth.uid() = user_id);

create policy "opportunities: owner reads"   on public.opportunities for select using (auth.uid() = user_id);
create policy "opportunities: owner inserts" on public.opportunities for insert with check (auth.uid() = user_id);
create policy "opportunities: owner updates" on public.opportunities for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "opportunities: owner deletes" on public.opportunities for delete using (auth.uid() = user_id);

-- Storage: résumés and headshots, private, each user in their own folder.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false), ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "files: owner reads" on storage.objects for select
  using (bucket_id in ('resumes', 'photos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files: owner writes" on storage.objects for insert
  with check (bucket_id in ('resumes', 'photos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files: owner updates" on storage.objects for update
  using (bucket_id in ('resumes', 'photos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "files: owner deletes" on storage.objects for delete
  using (bucket_id in ('resumes', 'photos') and (storage.foldername(name))[1] = auth.uid()::text);
