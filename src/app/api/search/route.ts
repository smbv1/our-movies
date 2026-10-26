import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  // Tolerate a pasted "Bearer " prefix, quotes or whitespace around the token.
  const credential = (process.env.TMDB_API_TOKEN ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "");
  if (!credential) {
    console.error("TMDB_API_TOKEN is not set");
    return NextResponse.json(
      { error: "На сервере не задана переменная TMDB_API_TOKEN" },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    query: q,
    language: "ru-RU",
    include_adult: "false",
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  // A 32-char hex value is the short v3 "API Key"; anything else is the v4 read access token.
  if (/^[0-9a-f]{32}$/i.test(credential)) {
    params.set("api_key", credential);
  } else {
    headers.Authorization = `Bearer ${credential}`;
  }

  let data: TmdbSearchResponse;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?${params.toString()}`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`TMDB search failed: ${res.status} ${body.slice(0, 300)}`);
      const reason =
        res.status === 401
          ? "TMDB не принял токен (401), проверь TMDB_API_TOKEN"
          : `TMDB ответил ошибкой ${res.status}`;
      return NextResponse.json({ error: reason }, { status: 502 });
    }
    data = (await res.json()) as TmdbSearchResponse;
  } catch (err) {
    console.error("TMDB search request failed", err);
    return NextResponse.json(
      { error: "Не удалось связаться с TMDB" },
      { status: 502 },
    );
  }

  const results: SearchResult[] = data.results
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
