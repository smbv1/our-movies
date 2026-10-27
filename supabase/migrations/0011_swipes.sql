-- Swipe mode («Тиндер для фильмов»): each partner swipes popular titles, and a
-- title both liked lands in «Хотим» with both marks.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- One row per person and title. Kept by user rather than list, so swipes survive
-- joining a partner's list. The title is copied from TMDB so a match can be added
-- to the list without calling TMDB from the database.
create table public.swipes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  liked boolean not null,
  title text not null,
  original_title text,
  year integer,
  poster_path text,
  overview text,
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);

-- Looking up the partner's like for a title.
create index swipes_title_idx on public.swipes (media_type, tmdb_id) where liked;

-- Each person sees and undoes only their own swipes; the partner's likes stay
-- hidden until they match. Writes go through swipe().
alter table public.swipes enable row level security;

create policy "read own swipes" on public.swipes
  for select to authenticated using (user_id = auth.uid());

create policy "delete own swipes" on public.swipes
  for delete to authenticated using (user_id = auth.uid());

grant select, delete on public.swipes to authenticated;

-- Saves the current user's swipe. When it is a like and the partner liked the same
-- title, the title goes to «Хотим» for both (or both marks are added if it is
-- already in the list), and the result names it: {"movie_id": ..., "created": true}.
-- Otherwise returns null.
create function public.swipe(
  p_media_type text,
  p_tmdb_id integer,
  p_liked boolean,
  p_title text,
  p_original_title text,
  p_year integer,
  p_poster_path text,
  p_overview text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_list uuid := public.my_list_id();
  partner uuid;
  movie_id uuid;
  created boolean;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_media_type not in ('movie', 'tv') then
    raise exception 'bad media type';
  end if;

  -- Partners liking the same title at the same moment would each miss the other's
  -- row; taking turns per title makes the second one see the first.
  if my_list is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(my_list::text || p_media_type || p_tmdb_id::text, 0)
    );
  end if;

  insert into public.swipes (
    user_id, media_type, tmdb_id, liked, title, original_title, year,
    poster_path, overview
  )
  values (
    me, p_media_type, p_tmdb_id, p_liked, left(p_title, 500),
    left(p_original_title, 500), p_year, p_poster_path, left(p_overview, 5000)
  )
  on conflict (user_id, media_type, tmdb_id) do update
    set liked = excluded.liked, created_at = now();

  if not p_liked or my_list is null then
    return null;
  end if;

  select s.user_id into partner
  from public.swipes s
  join public.profiles p on p.id = s.user_id
  where p.list_id = my_list
    and s.user_id <> me
    and s.media_type = p_media_type
    and s.tmdb_id = p_tmdb_id
    and s.liked
  limit 1;
  if partner is null then
    return null;
  end if;

  insert into public.movies (
    list_id, tmdb_id, media_type, title, original_title, year, poster_path,
    overview, status, added_by, wanted_by
  )
  values (
    my_list, p_tmdb_id, p_media_type, left(p_title, 500),
    left(p_original_title, 500), p_year, p_poster_path, left(p_overview, 5000),
    'want', me, array[partner, me]
  )
  on conflict (list_id, media_type, tmdb_id) do update
    set wanted_by = array(
      select distinct unnest(public.movies.wanted_by || excluded.wanted_by)
    )
  returning id, (xmax = 0) into movie_id, created;

  return jsonb_build_object('movie_id', movie_id, 'created', created);
end;
$$;

revoke execute on function public.swipe(text, integer, boolean, text, text, integer, text, text)
  from public, anon;
grant execute on function public.swipe(text, integer, boolean, text, text, integer, text, text)
  to authenticated;

-- Titles the partner liked that the current user hasn't swiped yet, so they come
-- first in the deck and a match is more likely. Only the titles are returned, not
-- who liked them, and the deck shows them like any other card.
create function public.partner_likes(p_media_type text)
returns table (
  tmdb_id integer,
  title text,
  original_title text,
  year integer,
  poster_path text,
  overview text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.tmdb_id, s.title, s.original_title, s.year, s.poster_path, s.overview
  from public.swipes s
  join public.profiles p on p.id = s.user_id
  where p.list_id = public.my_list_id()
    and s.user_id <> auth.uid()
    and s.media_type = p_media_type
    and s.liked
    and not exists (
      select 1 from public.swipes mine
      where mine.user_id = auth.uid()
        and mine.media_type = s.media_type
        and mine.tmdb_id = s.tmdb_id
    )
    and not exists (
      select 1 from public.movies m
      where m.list_id = p.list_id
        and m.media_type = s.media_type
        and m.tmdb_id = s.tmdb_id
    )
  order by s.created_at desc
  limit 50;
$$;

revoke execute on function public.partner_likes(text) from public, anon;
grant execute on function public.partner_likes(text) to authenticated;
