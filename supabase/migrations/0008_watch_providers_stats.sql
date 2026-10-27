-- Where to watch on the cards, the couple's own services, and numbers for stats.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- Streaming services from TMDB/JustWatch, kept on the row so the list can show
-- them without a TMDB call per card: [{"id": 8, "name": "Netflix",
-- "logo": "/abc.jpg", "kind": "sub"}], kind "sub" (subscription) or "free".
-- providers_region is where they apply (KG, else KZ, RU, US). details_at is when
-- the TMDB facts were last fetched; the site refreshes old ones on its own.
alter table public.movies
  add column providers jsonb check (jsonb_typeof(providers) = 'array'),
  add column providers_region text,
  add column episodes integer check (episodes > 0),
  add column details_at timestamptz;

-- TMDB provider ids of the services the couple pays for.
alter table public.lists
  add column services integer[] not null default '{}';

-- Lists have no update policy, so members change their services through this.
create function public.set_services(ids integer[])
returns integer[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  result integer[];
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(array_length(ids, 1), 0) > 50 then
    raise exception 'too many services';
  end if;

  update public.lists
  set services = coalesce(ids, '{}')
  where id = public.my_list_id()
  returning services into result;
  return result;
end;
$$;

revoke execute on function public.set_services(integer[]) from public, anon;
grant execute on function public.set_services(integer[]) to authenticated;
