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
};

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
