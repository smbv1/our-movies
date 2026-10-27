"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { MovieStatus, SearchResult } from "@/lib/types";

type ActionResult = { error: string | null };

const UNIQUE_VIOLATION = "23505";

export async function addMovie(
  movie: SearchResult,
  status: MovieStatus = "want",
): Promise<ActionResult> {
  const supabase = await createClient();
  // my_list_id() resolves the list from the session, so both run at once.
  const [userId, listRes] = await Promise.all([
    getUserId(supabase),
    supabase.rpc("my_list_id"),
  ]);
  if (!userId) {
    return { error: "Нужно войти в аккаунт" };
  }

  const listId: string | null = listRes.data ?? null;
  if (!listId) {
    return { error: "Сначала создайте список или присоединитесь к нему" };
  }

  const { error } = await supabase.from("movies").insert({
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
    added_by: userId,
  });

  if (error) {
    const noun = movie.media_type === "tv" ? "сериал" : "фильм";
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `Этот ${noun} уже в списке` };
    }
    return { error: `Не удалось добавить ${noun}` };
  }

  revalidatePath("/");
  return { error: null };
}

export async function setStatus(
  id: string,
  status: MovieStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("movies")
    .update({
      status,
      watched_at: status === "watched" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Не удалось обновить статус" };
  }

  revalidatePath("/");
  revalidatePath(`/movies/${id}`);
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
