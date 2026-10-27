import { toSearchResult, type TmdbListedTitle } from "@/lib/tmdb";
import {
  averageRating,
  searchKey,
  type Movie,
  type SearchResult,
} from "@/lib/types";

// A score from this up counts as "liked".
export const LIKED_SCORE = 7;
// How many watched titles feed TMDB recommendations; each is one request.
export const MAX_SEEDS = 8;
const MAX_SUGGESTIONS = 40;
// Obscure titles with a handful of votes are mostly noise.
const MIN_VOTES = 30;

export type SeedKind = "both" | "liked" | "recent";

export type Seed = { movie: Movie; weight: number };

// Titles the suggestions grow from, best first: ones every member scored LIKED_SCORE+,
// else ones liked on average, else the latest watched while nothing is rated yet.
export function pickSeeds(
  movies: Movie[],
  memberIds: string[],
): { kind: SeedKind; seeds: Seed[] } {
  const watched = movies.filter((m) => m.status === "watched");
  const scored = watched
    .map((movie) => ({ movie, avg: averageRating(movie.ratings) }))
    .filter((s): s is { movie: Movie; avg: number } => s.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  // With one member, "both" is just them.
  const both = scored.filter(({ movie }) =>
    memberIds.every((id) => (movie.ratings[id] ?? 0) >= LIKED_SCORE),
  );
  if (both.length > 0) {
    return {
      kind: "both",
      seeds: both.slice(0, MAX_SEEDS).map(({ movie, avg }) => ({ movie, weight: avg })),
    };
  }

  const liked = scored.filter(({ avg }) => avg >= LIKED_SCORE);
  if (liked.length > 0) {
    return {
      kind: "liked",
      seeds: liked.slice(0, MAX_SEEDS).map(({ movie, avg }) => ({ movie, weight: avg })),
    };
  }

  // Only when nothing is rated at all; low scores are not a reason to suggest more.
  if (scored.length > 0) return { kind: "recent", seeds: [] };
  const recent = [...watched]
    .sort((a, b) => (b.watched_at ?? "").localeCompare(a.watched_at ?? ""))
    .slice(0, MAX_SEEDS);
  return { kind: "recent", seeds: recent.map((movie) => ({ movie, weight: 1 })) };
}

export type Recommendation = {
  movie: SearchResult;
  // Seeds that led to it, strongest first.
  because: string[];
};

// Merges each seed's TMDB recommendations: a title that comes up for several liked
// titles, high in their lists, ranks first. Titles already in the list are left out.
export function rankRecommendations(
  seeds: Seed[],
  results: (TmdbListedTitle[] | null)[],
  inList: Set<string>,
): Recommendation[] {
  const byKey = new Map<
    string,
    { movie: SearchResult; score: number; because: { title: string; part: number }[] }
  >();

  seeds.forEach((seed, s) => {
    const list = results[s] ?? [];
    list.forEach((item, rank) => {
      if ((item.vote_count ?? 0) < MIN_VOTES) return;
      const movie = toSearchResult(item, seed.movie.media_type);
      if (!movie) return;
      const key = searchKey(movie);
      if (inList.has(key)) return;
      // Earlier in a seed's list and from a better-liked seed weighs more.
      const part = seed.weight * (1 - rank / Math.max(list.length, 1) / 2);
      const entry = byKey.get(key);
      if (entry) {
        entry.score += part;
        entry.because.push({ title: seed.movie.title, part });
      } else {
        byKey.set(key, {
          movie,
          score: part,
          because: [{ title: seed.movie.title, part }],
        });
      }
    });
  });

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ movie, because }) => ({
      movie,
      because: because.sort((a, b) => b.part - a.part).map((b) => b.title),
    }));
}

// "Похоже на «Дюна»", "Похоже на «Дюна» и ещё 2".
export function becauseNote(because: string[]): string {
  const [first, ...rest] = because;
  return rest.length === 0
    ? `Похоже на «${first}»`
    : `Похоже на «${first}» и ещё ${rest.length}`;
}
