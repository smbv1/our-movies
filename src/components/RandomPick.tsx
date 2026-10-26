"use client";

import { useEffect, useState, useTransition } from "react";
import { setStatus } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import { TMDB_IMAGE_BASE, type Movie } from "@/lib/types";

type RandomPickProps = {
  movies: Movie[];
  nameById: Record<string, string>;
};

// Picks a random index, avoiding the previous one when there is a choice.
function pickIndex(count: number, previous: number | null): number {
  if (count <= 1 || previous === null) {
    return Math.floor(Math.random() * count);
  }
  const next = Math.floor(Math.random() * (count - 1));
  return next >= previous ? next + 1 : next;
}

export default function RandomPick({ movies, nameById }: RandomPickProps) {
  const [index, setIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const movie = index !== null ? movies[index] : undefined;
  const isOpen = movie !== undefined;

  function close() {
    setIndex(null);
    setError(null);
  }

  function roll() {
    setError(null);
    setIndex((prev) => pickIndex(movies.length, prev));
  }

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIndex(null);
        setError(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  function handleWatched() {
    if (!movie) return;
    setError(null);
    startTransition(async () => {
      const result = await setStatus(movie.id, "watched");
      if (result.error) setError(result.error);
      else close();
    });
  }

  const isEmpty = movies.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={roll}
        disabled={isEmpty}
        title={isEmpty ? "Сначала добавьте фильмы в «Хотим»" : undefined}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        🎲 Что смотрим сегодня?
      </button>

      {movie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="random-pick-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl"
          >
            <div className="flex gap-4 p-4">
              {movie.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={movie.id}
                  src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                  alt={movie.title}
                  className="aspect-[2/3] w-32 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-[2/3] w-32 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500">
                  нет постера
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-amber-400">
                  Сегодня смотрим
                </p>
                <h2
                  id="random-pick-title"
                  className="text-lg font-bold leading-snug text-zinc-50"
                >
                  {movie.title}
                </h2>
                <p className="text-xs text-zinc-500">
                  {movie.year ?? "год неизвестен"}
                </p>
                <p className="text-xs text-zinc-500">
                  добавил(а): {nameById[movie.added_by] ?? "неизвестно"}
                </p>
              </div>
            </div>

            {movie.overview && (
              <p className="px-4 text-sm leading-relaxed text-zinc-400">
                {movie.overview}
              </p>
            )}

            {error && (
              <p role="alert" className="px-4 pt-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 p-4 sm:flex-row">
              <button
                type="button"
                onClick={roll}
                disabled={isPending || movies.length < 2}
                className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🎲 Другой
              </button>
              <button
                type="button"
                onClick={handleWatched}
                disabled={isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Spinner />
                    Сохраняем…
                  </>
                ) : (
                  "Посмотрели ✓"
                )}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="flex-1 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
