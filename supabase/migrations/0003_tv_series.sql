-- TV series in the shared list. Existing rows are movies.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

alter table public.movies
  add column media_type text not null default 'movie'
    check (media_type in ('movie', 'tv'));

-- TMDB numbers movies and series separately, so the same tmdb_id can be one of each.
alter table public.movies drop constraint movies_list_id_tmdb_id_key;
alter table public.movies
  add constraint movies_list_id_media_type_tmdb_id_key
    unique (list_id, media_type, tmdb_id);
