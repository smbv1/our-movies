"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getTitleDetails, titleFacts } from "@/lib/tmdb";
import { MAX_RATING, type MovieStatus, type SearchResult } from "@/lib/types";

type ActionResult = { error: string | null };

const UNIQUE_VIOLATION = "23505";

export async function addMovie(
  movie: SearchResult,
  status: MovieStatus = "want",
): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  // my_list_id() resolves the list from the session, so all three run at once.
  // Genres and runtime come from the details, which the title's page reuses from cache.
  const [userId, listRes, details] = await Promise.all([
    getUserId(supabase),
    supabase.rpc("my_list_id"),
    getTitleDetails(movie.media_type, movie.tmdb_id),
  ]);
  if (!userId) {
    return { error: "Нужно войти в аккаунт" };
  }

  const listId: string | null = listRes.data ?? null;
  if (!listId) {
    return { error: "Сначала создайте список или присоединитесь к нему" };
  }

  const { data, error } = await supabase
    .from("movies")
    .insert({
      list_id: listId,
      tmdb_id: movie.tmdb_id,
      media_type: movie.media_type,
      title: movie.title,
      original_title: movie.original_title,
      year: movie.year,
      poster_path: movie.poster_path,
      overview: movie.overview,
      status,
      watched_at: status === "watched" ? new Date().toISOString() : null,
      // Adding a title to «Хотим» means the adder wants it.
      wanted_by: status === "want" ? [userId] : [],
      added_by: userId,
      // If TMDB is down, these stay empty and fillMissingDetails catches up later.
      ...(details.data ? titleFacts(details.data) : {}),
    })
    .select("id")
    .single();

  if (error) {
    const noun = movie.media_type === "tv" ? "сериал" : "фильм";
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `Этот ${noun} уже в списке` };
    }
    return { error: `Не удалось добавить ${noun}` };
  }

  revalidatePath("/");
  return { error: null, id: data.id };
}

// `restoreWatchedAt` brings back the original watch date when a status change is undone;
// otherwise marking as watched stamps the current time.
export async function setStatus(
  id: string,
  status: MovieStatus,
  restoreWatchedAt?: string | null,
): Promise<ActionResult> {
  let watchedAt: string | null = null;
  if (status === "watched") {
    const restored = restoreWatchedAt ? new Date(restoreWatchedAt) : null;
    watchedAt =
      restored && !Number.isNaN(restored.getTime())
        ? restored.toISOString()
        : new Date().toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("movies")
    .update({ status, watched_at: watchedAt })
    .eq("id", id);

  if (error) {
    return { error: "Не удалось обновить статус" };
  }

  revalidatePath("/");
  revalidatePath(`/movies/${id}`);
  return { error: null };
}

// Marks or unmarks the title as wanted by the signed-in member only.
export async function setWant(id: string, wants: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_want", { movie_id: id, wants });

  if (error) {
    return { error: "Не удалось сохранить отметку" };
  }

  revalidatePath("/");
  return { error: null };
}

// Sets the signed-in member's score (1–10), or clears it with null.
export async function setRating(
  id: string,
  score: number | null,
): Promise<ActionResult> {
  if (score !== null && (!Number.isInteger(score) || score < 1 || score > MAX_RATING)) {
    return { error: "Оценка должна быть от 1 до 10" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_rating", { movie_id: id, score });

  if (error) {
    return { error: "Не удалось сохранить оценку" };
  }

  revalidatePath("/");
  revalidatePath(`/movies/${id}`);
  return { error: null };
}

// Titles added before genres were stored, per call; the rest come on the next visit.
const BACKFILL_BATCH = 20;

// Fetches genres and runtime for titles in the list that don't have them yet.
export async function fillMissingDetails(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("movies")
    .select("id, tmdb_id, media_type")
    .is("genres", null)
    .limit(BACKFILL_BATCH);
  if (error) return { error: "Не удалось загрузить список" };
  if (!rows.length) return { error: null };

  const updated = await Promise.all(
    rows.map(async (row) => {
      const details = await getTitleDetails(row.media_type, row.tmdb_id);
      // Left for a later try; an empty genre list still counts as fetched.
      if (!details.data) return false;
      const { error } = await supabase
        .from("movies")
        .update(titleFacts(details.data))
        .eq("id", row.id);
      return !error;
    }),
  );

  if (updated.some(Boolean)) revalidatePath("/");
  return { error: null };
}

export async function deleteMovie(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("movies").delete().eq("id", id);

  if (error) {
    return { error: "Не удалось удалить из списка" };
  }

  revalidatePath("/");
  return { error: null };
}
