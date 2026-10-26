import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserId } from "@/lib/supabase/server";
import { tmdbGet } from "@/lib/tmdb";
import type { SearchResult } from "@/lib/types";

type TmdbMovie = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path: string | null;
  overview: string;
};

type TmdbSearchResponse = {
  results: TmdbMovie[];
};

const MAX_RESULTS = 10;

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

  const res = await tmdbGet<TmdbSearchResponse>("/search/movie", {
    query: q,
    language: "ru-RU",
    include_adult: "false",
  }, { revalidate: SEARCH_CACHE_SECONDS });
  if (res.error !== null) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const results: SearchResult[] = res.data.results
    .slice(0, MAX_RESULTS)
    .map((movie) => {
      const year = parseInt(movie.release_date?.slice(0, 4) ?? "", 10);
      return {
        tmdb_id: movie.id,
        title: movie.title,
        original_title: movie.original_title ?? null,
        year: Number.isNaN(year) ? null : year,
        poster_path: movie.poster_path,
        overview: movie.overview || null,
      };
    });

  // The browser reuses results when the same query is typed again.
  return NextResponse.json(results, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
