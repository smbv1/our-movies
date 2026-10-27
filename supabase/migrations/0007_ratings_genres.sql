-- Ratings after watching, and genre/runtime data for filters.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- Each member's score from 1 to 10, keyed by their user id: {"<uuid>": 8}.
-- Kept on the row, like wanted_by, so the realtime subscription sees new scores.
alter table public.movies
  add column ratings jsonb not null default '{}'
    check (jsonb_typeof(ratings) = 'object');

-- Genre names from TMDB (in Russian) and the length in minutes (per episode for
-- series). Null genres means the details haven't been fetched yet; the site
-- fills them in for older titles on its own.
alter table public.movies
  add column genres text[],
  add column runtime integer check (runtime > 0);

-- Sets or clears (score null) the current user's score only, so one partner
-- can't change the other's. RLS on movies still limits it to the user's own list.
create function public.set_rating(movie_id uuid, score integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if score is not null and (score < 1 or score > 10) then
    raise exception 'score must be between 1 and 10';
  end if;

  update public.movies
  set ratings = case
    when score is null then ratings - auth.uid()::text
    else ratings || jsonb_build_object(auth.uid()::text, score)
  end
  where id = movie_id
  returning ratings into result;
  return result;
end;
$$;

revoke execute on function public.set_rating(uuid, integer) from public, anon;
grant execute on function public.set_rating(uuid, integer) to authenticated;

-- Same as 0006, but titles carried over from a solo list keep their ratings,
-- genres and runtime.
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
      overview, status, added_by, created_at, watched_at, wanted_by,
      ratings, genres, runtime
    )
    select
      found.id, tmdb_id, media_type, title, original_title, year, poster_path,
      overview, status, added_by, created_at, watched_at, wanted_by,
      ratings, genres, runtime
    from public.movies
    where list_id = old_list_id
    -- A title both had: keep the partner's row, and add the joiner's marks and rating to it.
    on conflict (list_id, media_type, tmdb_id) do update
      set wanted_by = array(
        select distinct unnest(public.movies.wanted_by || excluded.wanted_by)
      ),
      ratings = public.movies.ratings || excluded.ratings;

    delete from public.lists where id = old_list_id;
  end if;

  return found;
end;
$$;
