-- Keep strangers out of a couple's list.
-- A list holds at most two people, invite codes are longer and can be replaced,
-- and wrong codes are rate limited per account so codes can't be guessed by brute force.
-- Existing codes are replaced with new long ones (a paired couple doesn't need theirs any more).
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- 8 characters from 32 letters and digits, without look-alikes (0/O, 1/I): about 10^12 codes.
-- The bytes come from gen_random_uuid(), which is cryptographically random; 256 is a multiple
-- of 32, so every character is equally likely. Bytes 6 and 8 carry the uuid version and are skipped.
create function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := '';
  i int;
begin
  foreach i in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
    code := code || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);
  end loop;
  return code;
end;
$$;

revoke execute on function public.generate_invite_code() from public, anon, authenticated;

alter table public.lists alter column invite_code set default public.generate_invite_code();
update public.lists set invite_code = public.generate_invite_code();

-- Wrong codes typed by each account. Only join_list reads and writes it, so RLS has no policies.
create table public.join_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index join_attempts_user_id_attempted_at_idx
  on public.join_attempts (user_id, attempted_at desc);
alter table public.join_attempts enable row level security;

-- Wrong codes allowed per account per hour.
create function public.join_attempts_left()
returns int
language sql
stable
security definer set search_path = ''
as $$
  select greatest(0, 10 - count(*)::int)
  from public.join_attempts
  where user_id = auth.uid() and attempted_at > now() - interval '1 hour';
$$;
revoke execute on function public.join_attempts_left() from public, anon, authenticated;

-- Same as 0004, plus: a rate limit on wrong codes and at most two people per list.
-- A wrong code returns null instead of raising, so the attempt it records is kept
-- (raising would roll it back). The app tells the errors apart by their messages.
create or replace function public.join_list(code text)
returns public.lists
language plpgsql
security definer set search_path = ''
as $$
declare
  found public.lists;
  old_list_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if public.join_attempts_left() = 0 then
    raise exception 'too many attempts';
  end if;

  select * into found from public.lists
  where invite_code = upper(replace(replace(trim(code), ' ', ''), '-', ''));
  if found.id is null then
    insert into public.join_attempts (user_id) values (auth.uid());
    delete from public.join_attempts where attempted_at < now() - interval '1 day';
    return null;
  end if;

  select list_id into old_list_id from public.profiles where id = auth.uid();
  if old_list_id = found.id then
    return found;
  end if;

  if (select count(*) from public.profiles where list_id = found.id) >= 2 then
    raise exception 'list is full';
  end if;

  update public.profiles set list_id = found.id where id = auth.uid();

  -- Nobody else is left in the old list: bring its movies along and drop it.
  if old_list_id is not null
     and not exists (select 1 from public.profiles where list_id = old_list_id) then
    insert into public.movies (
      list_id, tmdb_id, media_type, title, original_title, year, poster_path,
      overview, status, added_by, created_at, watched_at
    )
    select
      found.id, tmdb_id, media_type, title, original_title, year, poster_path,
      overview, status, added_by, created_at, watched_at
    from public.movies
    where list_id = old_list_id
    on conflict (list_id, media_type, tmdb_id) do nothing;

    delete from public.lists where id = old_list_id;
  end if;

  return found;
end;
$$;

-- Replace the current list's code, for when the old one was shared too widely.
create function public.regenerate_invite_code()
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  new_code text;
begin
  if auth.uid() is null or public.my_list_id() is null then
    raise exception 'no list';
  end if;
  update public.lists set invite_code = public.generate_invite_code()
  where id = public.my_list_id()
  returning invite_code into new_code;
  return new_code;
end;
$$;

revoke execute on function public.regenerate_invite_code() from public, anon;
grant execute on function public.regenerate_invite_code() to authenticated;
