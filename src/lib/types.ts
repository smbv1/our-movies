export type MovieStatus = "want" | "watched";

// What a list item is on TMDB: a film or a TV series.
export type MediaType = "movie" | "tv";

export type Movie = {
  id: string;
  list_id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
  status: MovieStatus;
  added_by: string;
  created_at: string;
  watched_at: string | null;
  // Members who marked that they want to watch it («кто хочет»).
  wanted_by: string[];
  // Each member's score after watching, 1–10, keyed by member id.
  ratings: Record<string, number>;
  // TMDB genre names; null until the details have been fetched.
  genres: string[] | null;
  // Length in minutes (one episode for a series), when TMDB knows it.
  runtime: number | null;
  // Episodes in a series, for the total watch time in stats.
  episodes: number | null;
  // Where it streams (subscription or free), in providers_region; null until fetched.
  providers: StoredProvider[] | null;
  providers_region: string | null;
  // When the facts above were last taken from TMDB.
  details_at: string | null;
};

// Stored streaming services are refreshed from TMDB after this many days.
export const DETAILS_REFRESH_DAYS = 14;

// Whether a title's TMDB facts should be fetched again. Rows read before migration
// 0008 has run have no details_at at all (undefined) and only count when genres are missing.
export function needsDetails(m: Pick<Movie, "genres" | "details_at">): boolean {
  if (m.details_at === undefined) return m.genres === null;
  if (m.details_at === null) return true;
  return Date.now() - new Date(m.details_at).getTime() > DETAILS_REFRESH_DAYS * 864e5;
}

// A streaming service as the list stores it, from TMDB/JustWatch.
export type StoredProvider = {
  id: number;
  name: string;
  logo: string | null;
  kind: "sub" | "free";
};

// "1 ч 45 мин", "50 мин", "2 ч".
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

// Russian noun form for a count: plural(3, ["сезон", "сезона", "сезонов"]) → "3 сезона".
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;
  return `${n} ${word}`;
}

// Length buckets in minutes; a series is judged by one episode.
export const LENGTHS = {
  short: { label: "До 1,5 ч", test: (min: number) => min <= 90 },
  medium: { label: "До 2 ч", test: (min: number) => min <= 120 },
  long: { label: "Дольше 2 ч", test: (min: number) => min > 120 },
} as const;
export type LengthKey = keyof typeof LENGTHS;

// TMDB's Russian genre names are lowercase ("боевик").
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const MAX_RATING = 10;

export type RatingVerdict = "match" | "close" | "apart";

// How two scores compare: within a point is a match, three or more apart is a split.
export function ratingVerdict(scores: number[]): RatingVerdict | null {
  if (scores.length < 2) return null;
  const spread = Math.max(...scores) - Math.min(...scores);
  return spread <= 1 ? "match" : spread >= 3 ? "apart" : "close";
}

// Mean of the members' scores, or null when nobody has rated it.
export function averageRating(ratings: Record<string, number>): number | null {
  const scores = Object.values(ratings);
  if (scores.length === 0) return null;
  return scores.reduce((sum, n) => sum + n, 0) / scores.length;
}

export type Profile = {
  id: string;
  display_name: string;
  list_id: string | null;
};

export type List = {
  id: string;
  name: string;
  invite_code: string;
  // TMDB provider ids of the services the couple has.
  services: number[];
};

// Result shape returned by /api/search (trimmed TMDB movie or series).
export type SearchResult = {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
};

// An actor or director found by /api/search.
export type PersonResult = {
  tmdb_id: number;
  name: string;
  profile_path: string | null;
  // TMDB's department in English ("Acting", "Directing").
  department: string | null;
  // A few titles they are best known for.
  known_for: string[];
};

// "Acting" → "Актёр", for the line under a person's name.
export const DEPARTMENT_NAMES: Record<string, string> = {
  Acting: "Актёр",
  Directing: "Режиссёр",
  Writing: "Сценарист",
  Production: "Продюсер",
  Sound: "Композитор",
  Camera: "Оператор",
  Editing: "Монтажёр",
  Creator: "Создатель",
};

// What /api/search answers with.
export type SearchResponse = {
  titles: SearchResult[];
  people: PersonResult[];
};

// Identifies a TMDB title across films and series, e.g. "tv-1396".
export function searchKey(m: { media_type: MediaType; tmdb_id: number }): string {
  return `${m.media_type}-${m.tmdb_id}`;
}

export const TMDB_IMAGE_ORIGIN = "https://image.tmdb.org";

// Pre-sized images TMDB serves from its CDN; pick the smallest that covers the slot.
type TmdbImageSize = "w92" | "w185" | "w342" | "w500" | "w780";

export function tmdbImage(path: string, size: TmdbImageSize): string {
  return `${TMDB_IMAGE_ORIGIN}/t/p/${size}${path}`;
}

// srcSet for posters, so phones with dense screens and small slots each get a fitting file.
export function posterSrcSet(path: string): string {
  return (["w185", "w342", "w500"] as const)
    .map((size) => `${tmdbImage(path, size)} ${size.slice(1)}w`)
    .join(", ");
}
