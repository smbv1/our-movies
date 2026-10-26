// Server-only helpers for calling the TMDB API with TMDB_API_TOKEN.

// On failure, `status` is the HTTP status our own API should answer with.
export type TmdbResult<T> =
  | { data: T; error: null }
  | { data: null; error: string; status: 500 | 502 };

// Tolerate a pasted "Bearer " prefix, quotes or whitespace around the token.
function getCredential(): string {
  return (process.env.TMDB_API_TOKEN ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "");
}

// GETs a TMDB v3 path (e.g. "/search/movie") and returns parsed JSON or a user-facing error.
// With `revalidate`, successful responses are kept in the Next.js data cache for that many
// seconds, shared across serverless instances; errors are never cached.
export async function tmdbGet<T>(
  path: string,
  query: Record<string, string>,
  { revalidate }: { revalidate?: number } = {},
): Promise<TmdbResult<T>> {
  const credential = getCredential();
  if (!credential) {
    console.error("TMDB_API_TOKEN is not set");
    return {
      data: null,
      error: "На сервере не задана переменная TMDB_API_TOKEN",
      status: 500,
    };
  }

  const params = new URLSearchParams(query);
  const headers: Record<string, string> = { Accept: "application/json" };
  // A 32-char hex value is the short v3 "API Key"; anything else is the v4 read access token.
  if (/^[0-9a-f]{32}$/i.test(credential)) {
    params.set("api_key", credential);
  } else {
    headers.Authorization = `Bearer ${credential}`;
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3${path}?${params.toString()}`,
      revalidate
        ? { headers, cache: "force-cache", next: { revalidate } }
        : { headers, cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`TMDB ${path} failed: ${res.status} ${body.slice(0, 300)}`);
      const reason =
        res.status === 401
          ? "TMDB не принял токен (401), проверь TMDB_API_TOKEN"
          : `TMDB ответил ошибкой ${res.status}`;
      return { data: null, error: reason, status: 502 };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    console.error(`TMDB ${path} request failed`, err);
    return { data: null, error: "Не удалось связаться с TMDB", status: 502 };
  }
}

type TmdbVideo = {
  key: string;
  site: string;
  type: string;
  official: boolean;
  iso_639_1: string | null;
  name: string;
};

export type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
};

export type TmdbRegionProviders = {
  link: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
};

export type TmdbMovieDetails = {
  id: number;
  title: string;
  original_title: string;
  tagline: string | null;
  overview: string | null;
  runtime: number | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: { id: number; name: string }[];
  videos?: { results: TmdbVideo[] };
  "watch/providers"?: { results: Record<string, TmdbRegionProviders> };
};

export type TmdbSeason = {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
};

export type TmdbTvDetails = {
  id: number;
  name: string;
  original_name: string;
  tagline: string | null;
  overview: string | null;
  // Typical episode lengths in minutes; often empty for newer series.
  episode_run_time: number[];
  first_air_date: string | null;
  last_air_date: string | null;
  // "Returning Series", "Ended", "Canceled", "In Production", "Planned", "Pilot".
  status: string;
  number_of_seasons: number;
  number_of_episodes: number;
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: { id: number; name: string }[];
  seasons: TmdbSeason[];
  videos?: { results: TmdbVideo[] };
  "watch/providers"?: { results: Record<string, TmdbRegionProviders> };
};

// Details, trailers and providers change rarely, so a day-old copy is fine.
const DETAILS_CACHE_SECONDS = 24 * 60 * 60;

const DETAILS_QUERY = {
  language: "ru-RU",
  append_to_response: "videos,watch/providers",
  // Videos are filtered by language; also take English and language-less ones.
  include_video_language: "ru,en,null",
};

// Movie details with videos and watch providers in one request.
export function getMovieDetails(tmdbId: number) {
  return tmdbGet<TmdbMovieDetails>(`/movie/${tmdbId}`, DETAILS_QUERY, {
    revalidate: DETAILS_CACHE_SECONDS,
  });
}

// Series details (seasons, episode counts) with videos and watch providers in one request.
export function getTvDetails(tmdbId: number) {
  return tmdbGet<TmdbTvDetails>(`/tv/${tmdbId}`, DETAILS_QUERY, {
    revalidate: DETAILS_CACHE_SECONDS,
  });
}

// Best YouTube trailer: Russian before English, trailers before teasers, official first.
export function pickTrailer(videos: TmdbVideo[] | undefined): TmdbVideo | null {
  const youtube = (videos ?? []).filter(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
  );
  const score = (v: TmdbVideo) =>
    (v.iso_639_1 === "ru" ? 4 : 0) +
    (v.type === "Trailer" ? 2 : 0) +
    (v.official ? 1 : 0);
  return youtube.sort((a, b) => score(b) - score(a))[0] ?? null;
}

// Kyrgyzstan first; TMDB/JustWatch rarely covers it, so fall back to neighbours, then the US.
export const WATCH_REGIONS = ["KG", "KZ", "RU", "US"] as const;

export const REGION_NAMES: Record<(typeof WATCH_REGIONS)[number], string> = {
  KG: "Кыргызстан",
  KZ: "Казахстан",
  RU: "Россия",
  US: "США",
};

// First region from WATCH_REGIONS that has at least one provider.
export function pickWatchRegion(
  results: Record<string, TmdbRegionProviders> | undefined,
) {
  for (const region of WATCH_REGIONS) {
    const providers = results?.[region];
    if (
      providers &&
      (providers.flatrate?.length ||
        providers.free?.length ||
        providers.ads?.length ||
        providers.rent?.length ||
        providers.buy?.length)
    ) {
      return { region, providers };
    }
  }
  return null;
}
