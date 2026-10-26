"use client";

import { useOptimistic } from "react";
import MovieCard from "@/components/MovieCard";
import type { Movie } from "@/lib/types";

type MovieGridProps = {
  movies: Movie[];
  nameById: Record<string, string>;
  emptyText: string;
};

// Cards that the current tab shows above the fold: loaded first, the rest lazily.
const EAGER_COUNT = 4;

export default function MovieGrid({ movies, nameById, emptyText }: MovieGridProps) {
  // A card leaves the tab as soon as it is marked watched or deleted. If the
  // action fails, the transition ends and the card comes back with its error.
  const [leavingIds, markLeaving] = useOptimistic(
    new Set<string>(),
    (ids, id: string) => new Set(ids).add(id),
  );
  const visibleCount = movies.filter((m) => !leavingIds.has(m.id)).length;

  return (
    <>
      {visibleCount === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {emptyText}
        </p>
      )}
      {movies.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {movies.map((movie, i) => (
            // Hidden rather than removed, so the card keeps its state if it comes back.
            <li key={movie.id} hidden={leavingIds.has(movie.id)}>
              <MovieCard
                movie={movie}
                addedByName={nameById[movie.added_by] ?? "неизвестно"}
                eager={i < EAGER_COUNT}
                onLeave={() => markLeaving(movie.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
