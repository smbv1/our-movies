-- Notes on a title («смотреть с попкорном», «посоветовала Аня»), one per member,
-- visible to both partners.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- Each member's note keyed by their user id: {"<uuid>": "text"}.
-- Kept on the row, like wanted_by and ratings, so the realtime subscription sees edits.
alter table public.movies
  add column notes jsonb not null default '{}'
    check (jsonb_typeof(notes) = 'object');

-- Sets or clears (empty or null body) the current user's note only, so one partner
-- can't change the other's. RLS on movies still limits it to the user's own list.
create function public.set_note(movie_id uuid, body text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean text := nullif(trim(body), '');
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if char_length(clean) > 500 then
    raise exception 'note is too long';
  end if;

  update public.movies
  set notes = case
    when clean is null then notes - auth.uid()::text
    else notes || jsonb_build_object(auth.uid()::text, clean)
  end
  where id = movie_id
  returning notes into result;
  return result;
end;
$$;

revoke execute on function public.set_note(uuid, text) from public, anon;
grant execute on function public.set_note(uuid, text) to authenticated;
