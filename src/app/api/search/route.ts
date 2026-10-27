import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserId } from "@/lib/supabase/server";
import { tmdbGet, toSearchResult, type TmdbListedTitle } from "@/lib/tmdb";
import type { PersonResult, SearchResponse } from "@/lib/types";

// /search/multi mixes films, series and people.
type TmdbPersonResult = {
  media_type: "person";
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
  known_for?: TmdbListedTitle[];
};

type TmdbSearchResponse = {
  results: (TmdbListedTitle | TmdbPersonResult)[];
};

const MAX_RESULTS = 10;
const MAX_PEOPLE = 3;

function isPerson(item: TmdbListedTitle | TmdbPersonResult): item is TmdbPersonResult {
  return item.media_type === "person";
}

function toPersonResult(item: TmdbPersonResult): PersonResult {
  return {
    tmdb_id: item.id,
    name: item.name,
    profile_path: item.profile_path,
    department: item.known_for_department ?? null,
    known_for: (item.known_for ?? [])
      .map((t) => t.title ?? t.name)
      .filter((t): t is string => !!t)
      .slice(0, 3),
  };
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
    return NextResponse.json({ titles: [], people: [] } satisfies SearchResponse);
  }

  const res = await tmdbGet<TmdbSearchResponse>("/search/multi", {
    query: q,
    language: "ru-RU",
    include_adult: "false",
  }, { revalidate: SEARCH_CACHE_SECONDS });
  if (res.error !== null) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const titles = res.data.results
    .map((item) => (isPerson(item) ? null : toSearchResult(item)))
    .filter((item) => item !== null)
    .slice(0, MAX_RESULTS);
  // Only people with a photo or known titles; TMDB has many namesakes nobody looks for.
  const people = res.data.results
    .filter(isPerson)
    .filter((p) => p.profile_path || p.known_for?.length)
    .slice(0, MAX_PEOPLE)
    .map(toPersonResult);

  // The browser reuses results when the same query is typed again.
  return NextResponse.json({ titles, people } satisfies SearchResponse, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
