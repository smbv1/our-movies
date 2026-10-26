import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
  });
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

  return NextResponse.json(results);
}
