"use client";

import { useState, useTransition } from "react";
import { deleteMovie, setStatus } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import { TMDB_IMAGE_BASE, type Movie } from "@/lib/types";

type MovieCardProps = {
  movie: Movie;
  addedByName: string;
};

type PendingAction = "status" | "delete";

export default function MovieCard({ movie, addedByName }: MovieCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function handleStatus() {
    const next = movie.status === "want" ? "watched" : "want";
    setError(null);
    setPendingAction("status");
    startTransition(async () => {
      try {
        const result = await setStatus(movie.id, next);
        if (result.error) setError(result.error);
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Удалить «${movie.title}» из списка?`)) return;
    setError(null);
    setPendingAction("delete");
    startTransition(async () => {
      try {
        const result = await deleteMovie(movie.id);
        if (result.error) setError(result.error);
      } finally {
        setPendingAction(null);
      }
    });
  }

  const isWatched = movie.status === "watched";

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {movie.poster_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
          alt={movie.title}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-sm text-zinc-500">
          нет постера
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
            {movie.title}
          </h3>
          <p className="text-xs text-zinc-500">
            {movie.year ?? "год неизвестен"}
          </p>
        </div>

        {movie.overview && (
          <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400">
            {movie.overview}
          </p>
        )}

        <p className="text-xs text-zinc-500">добавил(а): {addedByName}</p>

        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={handleStatus}
            disabled={isPending}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isWatched
                ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
            }`}
          >
            {pendingAction === "status" ? (
              <>
                <Spinner />
                Сохраняем…
              </>
            ) : isWatched ? (
              "Вернуть в «Хотим»"
            ) : (
              "Посмотрели ✓"
            )}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction === "delete" ? (
              <>
                <Spinner />
                Удаляем…
              </>
            ) : (
              "Удалить"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
