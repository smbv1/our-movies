export type MovieStatus = "want" | "watched";

export type Movie = {
  id: string;
  list_id: string;
  tmdb_id: number;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
  status: MovieStatus;
  added_by: string;
  created_at: string;
  watched_at: string | null;
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

// Result shape returned by /api/search (trimmed TMDB movie).
export type SearchResult = {
  tmdb_id: number;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
};

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
