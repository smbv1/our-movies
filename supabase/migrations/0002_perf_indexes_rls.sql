-- Performance hygiene suggested by the Supabase advisor. Same access rules as before.

-- Cover the foreign keys used by RLS (profiles.list_id), joins (movies.added_by)
-- and the home page ordering (movies by list, newest first).
create index profiles_list_id_idx on public.profiles (list_id);
create index movies_added_by_idx on public.movies (added_by);
create index movies_list_id_created_at_idx on public.movies (list_id, created_at desc);
drop index public.movies_list_id_idx;

-- Wrap auth.uid() and my_list_id() in a subselect, so Postgres evaluates them once
-- per query instead of once per row.
alter policy "members read their list" on public.lists
  using (id = (select public.my_list_id()));

alter policy "read own and list members' profiles" on public.profiles
  using (id = (select auth.uid()) or list_id = (select public.my_list_id()));

alter policy "update own profile" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy "members read movies" on public.movies
  using (list_id = (select public.my_list_id()));

alter policy "members add movies" on public.movies
  with check (list_id = (select public.my_list_id()) and added_by = (select auth.uid()));

alter policy "members update movies" on public.movies
  using (list_id = (select public.my_list_id()))
  with check (list_id = (select public.my_list_id()));

alter policy "members delete movies" on public.movies
  using (list_id = (select public.my_list_id()));
