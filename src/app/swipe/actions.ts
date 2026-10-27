"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import { loadSwipeDeck, type SwipeDeck } from "@/lib/swipe";
import { getTitleDetails, titleFacts } from "@/lib/tmdb";
import type { MediaType, SearchResult } from "@/lib/types";

type ActionResult = { error: string | null };

function isMediaType(kind: unknown): kind is MediaType {
  return kind === "movie" || kind === "tv";
}

// More cards for the deck, from TMDB page `page` on.
export async function loadMoreCards(
  kind: MediaType,
  page: number,
): Promise<SwipeDeck & ActionResult> {
  if (!isMediaType(kind) || !Number.isInteger(page) || page < 1) {
    return { cards: [], nextPage: null, error: "Неверный запрос" };
  }
  return loadSwipeDeck(kind, page);
}

// Saves a like or a pass. When both partners liked the title, it is now in «Хотим»
// and `match` names its row.
export async function swipeTitle(
  card: SearchResult,
  liked: boolean,
): Promise<ActionResult & { match?: { id: string } }> {
  if (!isMediaType(card.media_type) || !Number.isInteger(card.tmdb_id)) {
    return { error: "Неверный запрос" };
  }
  const supabase = await createClient();
  if (!(await getUserId(supabase))) {
    return { error: "Нужно войти в аккаунт" };
  }

  const { data, error } = await supabase.rpc("swipe", {
    p_media_type: card.media_type,
    p_tmdb_id: card.tmdb_id,
    p_liked: liked,
    p_title: card.title,
    p_original_title: card.original_title,
    p_year: card.year,
    p_poster_path: card.poster_path,
    p_overview: card.overview,
  });
  if (error) {
    return { error: "Не удалось сохранить выбор" };
  }

  const match = data as { movie_id: string; created: boolean } | null;
  if (!match) return { error: null };

  // A new row has only what the card had; genres, runtime and services come from
  // the details, like when adding from search. If TMDB is down, the list's
  // backfill catches up later.
  if (match.created) {
    const details = await getTitleDetails(card.media_type, card.tmdb_id);
    if (details.data) {
      await supabase
        .from("movies")
        .update(titleFacts(details.data))
        .eq("id", match.movie_id);
    }
  }

  revalidatePath("/");
  return { error: null, match: { id: match.movie_id } };
}

// Takes back the user's last swipe, so the card can be decided again.
export async function undoSwipe(
  kind: MediaType,
  tmdbId: number,
): Promise<ActionResult> {
  if (!isMediaType(kind) || !Number.isInteger(tmdbId)) {
    return { error: "Неверный запрос" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("swipes")
    .delete()
    .eq("media_type", kind)
    .eq("tmdb_id", tmdbId);
  if (error) {
    return { error: "Не удалось отменить" };
  }
  return { error: null };
}
