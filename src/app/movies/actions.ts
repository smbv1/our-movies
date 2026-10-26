"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MovieStatus, SearchResult } from "@/lib/types";

type ActionResult = { error: string | null };

const UNIQUE_VIOLATION = "23505";

export async function addMovie(movie: SearchResult): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Нужно войти в аккаунт" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("list_id")
    .eq("id", user.id)
    .maybeSingle();
  const listId: string | null = profile?.list_id ?? null;
  if (!listId) {
    return { error: "Сначала создайте список или присоединитесь к нему" };
  }

  const { error } = await supabase.from("movies").insert({
    list_id: listId,
    tmdb_id: movie.tmdb_id,
    title: movie.title,
    original_title: movie.original_title,
    year: movie.year,
    poster_path: movie.poster_path,
    overview: movie.overview,
    status: "want",
    added_by: user.id,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "Этот фильм уже в списке" };
    }
    return { error: "Не удалось добавить фильм" };
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
    return { error: "Не удалось обновить фильм" };
  }

  revalidatePath("/");
  return { error: null };
}

export async function deleteMovie(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("movies").delete().eq("id", id);

  if (error) {
    return { error: "Не удалось удалить фильм" };
  }

  revalidatePath("/");
  return { error: null };
}
