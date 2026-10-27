-- Joining a partner's list later, from the "Наша пара" dialog.
-- A user who skipped the code at sign-up already has a list of their own. When they
-- join by code and were the only member there, their movies move to the new list
-- (duplicates are dropped) and the empty old list is deleted.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

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
  select * into found from public.lists where invite_code = upper(trim(code));
  if found.id is null then
    raise exception 'invalid invite code';
  end if;

  select list_id into old_list_id from public.profiles where id = auth.uid();
  if old_list_id = found.id then
    return found;
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
