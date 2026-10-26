import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserId } from "@/lib/supabase/server";
import { tmdbGet } from "@/lib/tmdb";
import type { SearchResult } from "@/lib/types";

// /search/multi mixes films, series and people; films and series name their fields differently.
type TmdbMultiResult =
  | {
      media_type: "movie";
      id: number;
      title: string;
      original_title?: string;
      release_date?: string;
      poster_path: string | null;
      overview: string;
    }
  | {
      media_type: "tv";
      id: number;
      name: string;
      original_name?: string;
      first_air_date?: string;
      poster_path: string | null;
      overview: string;
    }
  | { media_type: "person"; id: number };

type TmdbSearchResponse = {
  results: TmdbMultiResult[];
};

const MAX_RESULTS = 10;

function parseYear(date: string | undefined): number | null {
  const year = parseInt(date?.slice(0, 4) ?? "", 10);
  return Number.isNaN(year) ? null : year;
}

// Films and series in one shape; people are dropped.
function toSearchResult(item: TmdbMultiResult): SearchResult | null {
  if (item.media_type === "movie") {
    return {
      tmdb_id: item.id,
      media_type: "movie",
      title: item.title,
      original_title: item.original_title ?? null,
      year: parseYear(item.release_date),
      poster_path: item.poster_path,
      overview: item.overview || null,
    };
  }
  if (item.media_type === "tv") {
    return {
      tmdb_id: item.id,
      media_type: "tv",
      title: item.name,
      original_title: item.original_name ?? null,
      year: parseYear(item.first_air_date),
      poster_path: item.poster_path,
      overview: item.overview || null,
    };
  }
  return null;
}

// TMDB search results barely change; the server keeps them for an hour.
const SEARCH_CACHE_SECONDS = 60 * 60;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!(await getUserId(supabase))) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const res = await tmdbGet<TmdbSearchResponse>("/search/multi", {
    query: q,
    language: "ru-RU",
    include_adult: "false",
  }, { revalidate: SEARCH_CACHE_SECONDS });
  if (res.error !== null) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const results = res.data.results
    .map(toSearchResult)
    .filter((item) => item !== null)
    .slice(0, MAX_RESULTS);

  // The browser reuses results when the same query is typed again.
  return NextResponse.json(results, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
