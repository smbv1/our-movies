-- «Кто хочет»: each partner marks which titles in «Хотим» they want to watch,
-- and the list updates live for both partners (Supabase Realtime).
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- Members who want to watch the title. Kept on the row itself, so a single
-- realtime subscription on movies sees every change.
alter table public.movies
  add column wanted_by uuid[] not null default '{}';

-- Until now adding a title meant "I want it".
update public.movies set wanted_by = array[added_by] where status = 'want';

-- Marks or unmarks the title for the current user only, so one partner can't
-- change the other's mark. RLS on movies still limits it to the user's own list.
create function public.set_want(movie_id uuid, wants boolean)
returns uuid[]
language sql
security invoker
set search_path = ''
as $$
  update public.movies
  set wanted_by = case
    when wants then array_append(array_remove(wanted_by, auth.uid()), auth.uid())
    else array_remove(wanted_by, auth.uid())
  end
  where id = movie_id
  returning wanted_by;
$$;

revoke execute on function public.set_want(uuid, boolean) from public, anon;
grant execute on function public.set_want(uuid, boolean) to authenticated;

-- Same as 0005, but titles carried over from a solo list keep their «хочу» marks.
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
      overview, status, added_by, created_at, watched_at, wanted_by
    )
    select
      found.id, tmdb_id, media_type, title, original_title, year, poster_path,
      overview, status, added_by, created_at, watched_at, wanted_by
    from public.movies
    where list_id = old_list_id
    -- A title both had: keep the partner's row, and add the joiner's marks to it.
    on conflict (list_id, media_type, tmdb_id) do update
      set wanted_by = array(
        select distinct unnest(public.movies.wanted_by || excluded.wanted_by)
      );

    delete from public.lists where id = old_list_id;
  end if;

  return found;
end;
$$;

-- Send inserts, updates and deletes of movies to signed-in members over Realtime.
-- Realtime applies the table's RLS, so each person only hears about their own list.
alter publication supabase_realtime add table public.movies;
