"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getTitleDetails, titleFacts } from "@/lib/tmdb";
import {
  DETAILS_REFRESH_DAYS,
  MAX_NOTE_LENGTH,
  MAX_RATING,
  type EpisodeSpot,
  type MovieStatus,
  type SearchResult,
} from "@/lib/types";

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

// Sets the signed-in member's note on the title, or clears it when empty.
export async function setNote(id: string, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (text.length > MAX_NOTE_LENGTH) {
    return { error: `Заметка длиннее ${MAX_NOTE_LENGTH} символов` };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_note", { movie_id: id, body: text });

  if (error) {
    return { error: "Не удалось сохранить заметку" };
  }

  revalidatePath("/");
  revalidatePath(`/movies/${id}`);
  return { error: null };
}

// Saves the last episode the couple watched in a series, or clears it with null.
export async function setProgress(
  id: string,
  spot: EpisodeSpot | null,
): Promise<ActionResult> {
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 10000;
  if (spot && !(valid(spot.season) && valid(spot.episode))) {
    return { error: "Неверный номер сезона или серии" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("movies")
    .update({
      progress_season: spot?.season ?? null,
      progress_episode: spot?.episode ?? null,
      progress_at: spot ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("media_type", "tv");

  if (error) {
    return { error: "Не удалось сохранить серию" };
  }

  revalidatePath("/");
  revalidatePath(`/movies/${id}`);
  return { error: null };
}

// Titles refreshed from TMDB per call; the rest come with the next batch or visit.
const BACKFILL_BATCH = 20;

// Fetches genres, runtime, episodes and streaming services for titles that never had
// them or whose copy is older than DETAILS_REFRESH_DAYS (services come and go).
export async function fillMissingDetails(): Promise<ActionResult> {
  const supabase = await createClient();
  const staleBefore = new Date(
    Date.now() - DETAILS_REFRESH_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: rows, error } = await supabase
    .from("movies")
    .select("id, tmdb_id, media_type")
    .or(`details_at.is.null,details_at.lt."${staleBefore}"`)
    .order("details_at", { ascending: true, nullsFirst: true })
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

// Saves which streaming services the couple has (TMDB provider ids).
export async function setServices(ids: number[]): Promise<ActionResult> {
  const clean = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_services", { ids: clean });

  if (error) {
    return { error: "Не удалось сохранить сервисы" };
  }

  revalidatePath("/");
  revalidatePath("/stats");
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
