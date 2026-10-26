"use client";

import { useState, useTransition } from "react";
import { setStatus } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import type { MovieStatus } from "@/lib/types";

type StatusToggleProps = {
  movieId: string;
  status: MovieStatus;
};

export default function StatusToggle({ movieId, status }: StatusToggleProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isWatched = status === "watched";

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await setStatus(movieId, isWatched ? "want" : "watched");
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isWatched
            ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
        }`}
      >
        {isPending ? (
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
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
