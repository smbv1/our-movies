-- Our Movies: shared watchlist schema.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

create extension if not exists pgcrypto;

-- A shared list (one per couple).
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Наш список',
  invite_code text not null unique
    default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at timestamptz not null default now()
);

-- One profile per auth user; list_id is the list they belong to.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  list_id uuid references public.lists (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  tmdb_id integer not null,
  title text not null,
  original_title text,
  year integer,
  poster_path text,
  overview text,
  status text not null default 'want' check (status in ('want', 'watched')),
  added_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  watched_at timestamptz,
  unique (list_id, tmdb_id)
);

create index movies_list_id_idx on public.movies (list_id);

-- Create a profile automatically on sign-up, using the name passed in user metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The list the current user belongs to (security definer avoids RLS recursion).
create function public.my_list_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select list_id from public.profiles where id = auth.uid();
$$;

-- Create a new list and join it.
create function public.create_list()
returns public.lists
language plpgsql
security definer set search_path = ''
as $$
declare
  new_list public.lists;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.lists default values returning * into new_list;
  update public.profiles set list_id = new_list.id where id = auth.uid();
  return new_list;
end;
$$;

-- Join an existing list by its invite code.
create function public.join_list(code text)
returns public.lists
language plpgsql
security definer set search_path = ''
as $$
declare
  found public.lists;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into found from public.lists where invite_code = upper(trim(code));
  if found.id is null then
    raise exception 'invalid invite code';
  end if;
  update public.profiles set list_id = found.id where id = auth.uid();
  return found;
end;
$$;

-- Row Level Security: you only see your own list, its members and its movies.
alter table public.lists enable row level security;
alter table public.profiles enable row level security;
alter table public.movies enable row level security;

create policy "members read their list" on public.lists
  for select to authenticated using (id = public.my_list_id());

create policy "read own and list members' profiles" on public.profiles
  for select to authenticated using (id = auth.uid() or list_id = public.my_list_id());

create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- list_id may only change through create_list / join_list.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "members read movies" on public.movies
  for select to authenticated using (list_id = public.my_list_id());

create policy "members add movies" on public.movies
  for insert to authenticated
  with check (list_id = public.my_list_id() and added_by = auth.uid());

create policy "members update movies" on public.movies
  for update to authenticated
  using (list_id = public.my_list_id()) with check (list_id = public.my_list_id());

create policy "members delete movies" on public.movies
  for delete to authenticated using (list_id = public.my_list_id());
