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

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
