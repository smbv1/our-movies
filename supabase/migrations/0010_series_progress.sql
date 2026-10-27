-- Where the couple stopped in a series: the last episode they watched.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- One shared spot per series (the couple watches together). Both numbers are
-- set or both are null (not started). progress_at is when it last moved.
alter table public.movies
  add column progress_season integer check (progress_season > 0),
  add column progress_episode integer check (progress_episode > 0),
  add column progress_at timestamptz,
  add constraint movies_progress_pair
    check ((progress_season is null) = (progress_episode is null));
