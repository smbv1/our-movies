// Server-only: the deck of popular titles for the swipe mode.

import { createClient } from "@/lib/supabase/server";
import { tmdbGet } from "@/lib/tmdb";
import { searchKey, type MediaType, type SearchResult } from "@/lib/types";

// A card in the deck: the title as the list would store it, plus what helps decide.
export type SwipeCard = SearchResult & {
  vote_average: number | null;
  genres: string[];
};

export type SwipeDeck = {
  cards: SwipeCard[];
  // TMDB page to continue from, or null when there is nothing more to load.
  nextPage: number | null;
};

type TmdbDiscoverItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids: number[];
};

type TmdbDiscoverResponse = {
  page: number;
  total_pages: number;
  results: TmdbDiscoverItem[];
};

// Popular lists change slowly; both partners get the same pages, in the same order.
const DISCOVER_CACHE_SECONDS = 6 * 60 * 60;
const GENRES_CACHE_SECONDS = 7 * 24 * 60 * 60;
// TMDB serves at most 500 pages of any list.
const LAST_PAGE = 500;
// One call fetches pages until it has this many unseen cards, or gives up after MAX_PAGES.
const DECK_SIZE = 15;
const MAX_PAGES = 6;

function parseYear(date: string | undefined): number | null {
  const year = parseInt(date?.slice(0, 4) ?? "", 10);
  return Number.isNaN(year) ? null : year;
}

async function genreNames(kind: MediaType): Promise<Map<number, string>> {
  const res = await tmdbGet<{ genres: { id: number; name: string }[] }>(
    `/genre/${kind}/list`,
    { language: "ru-RU" },
    { revalidate: GENRES_CACHE_SECONDS },
  );
  return new Map((res.data?.genres ?? []).map((g) => [g.id, g.name]));
}

// Well-known titles first: by popularity, but only ones enough people have rated,
// so the deck isn't full of this week's obscure releases.
function discoverPage(kind: MediaType, page: number) {
  return tmdbGet<TmdbDiscoverResponse>(
    `/discover/${kind}`,
    {
      language: "ru-RU",
      sort_by: "popularity.desc",
      include_adult: "false",
      "vote_count.gte": kind === "movie" ? "300" : "150",
      page: String(page),
    },
    { revalidate: DISCOVER_CACHE_SECONDS },
  );
}

// Titles the user already swiped or the list already has, as searchKey values.
async function seenKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Set<string>> {
  const [swipes, movies] = await Promise.all([
    supabase.from("swipes").select("media_type, tmdb_id"),
    supabase.from("movies").select("media_type, tmdb_id"),
  ]);
  return new Set(
    [...(swipes.data ?? []), ...(movies.data ?? [])].map((m) => searchKey(m)),
  );
}

// Unseen cards starting at TMDB page `fromPage`. On the first page the partner's
// likes come first, so a match is likely without saying who liked what.
export async function loadSwipeDeck(
  kind: MediaType,
  fromPage: number,
): Promise<SwipeDeck & { error: string | null }> {
  const supabase = await createClient();
  const [seen, genres, partner] = await Promise.all([
    seenKeys(supabase),
    genreNames(kind),
    fromPage === 1
      ? supabase.rpc("partner_likes", { p_media_type: kind })
      : Promise.resolve({ data: [] }),
  ]);

  const cards: SwipeCard[] = [];
  const add = (card: SwipeCard) => {
    const key = searchKey(card);
    if (seen.has(key)) return;
    seen.add(key);
    cards.push(card);
  };

  type PartnerLike = Omit<SearchResult, "media_type">;
  for (const p of (partner.data ?? []) as PartnerLike[]) {
    add({ ...p, media_type: kind, vote_average: null, genres: [] });
  }

  let page = Math.max(1, Math.min(fromPage, LAST_PAGE));
  let lastPage = LAST_PAGE;
  let error: string | null = null;
  for (let i = 0; i < MAX_PAGES && cards.length < DECK_SIZE && page <= lastPage; i++) {
    const res = await discoverPage(kind, page);
    if (res.error !== null) {
      error = res.error;
      break;
    }
    lastPage = Math.min(res.data.total_pages, LAST_PAGE);
    for (const item of res.data.results) {
      // Without a poster or a description there's nothing to decide on.
      if (!item.poster_path || !item.overview) continue;
      add({
        tmdb_id: item.id,
        media_type: kind,
        title: (kind === "tv" ? item.name : item.title) ?? "",
        original_title:
          (kind === "tv" ? item.original_name : item.original_title) ?? null,
        year: parseYear(kind === "tv" ? item.first_air_date : item.release_date),
        poster_path: item.poster_path,
        overview: item.overview,
        vote_average: item.vote_average || null,
        genres: item.genre_ids.flatMap((id) => genres.get(id) ?? []),
      });
    }
    page += 1;
  }

  return {
    cards,
    nextPage: error && cards.length === 0 ? fromPage : page <= lastPage ? page : null,
    error: cards.length === 0 ? error : null,
  };
}
