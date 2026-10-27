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
};

// "1 ч 45 мин", "50 мин", "2 ч".
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
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
