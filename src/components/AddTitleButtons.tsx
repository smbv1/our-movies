"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addMovie } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import type { MovieStatus, SearchResult } from "@/lib/types";

type AddTitleButtonsProps = {
  movie: SearchResult;
  // The tab search was opened from; its button is the bright one.
  preferred: MovieStatus;
};

const LABELS: Record<MovieStatus, { button: string; tab: string }> = {
  want: { button: "+ Хотим", tab: "Хотим" },
  watched: { button: "✓ Посмотрели", tab: "Посмотрели" },
};

export default function AddTitleButtons({
  movie,
  preferred,
}: AddTitleButtonsProps) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<MovieStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const order: MovieStatus[] =
    preferred === "watched" ? ["watched", "want"] : ["want", "watched"];

  // Once saved, the title has a list row; its regular page takes over.
  function handleAdd(status: MovieStatus) {
    setError(null);
    setPendingStatus(status);
    startTransition(async () => {
      const result = await addMovie(movie, status);
      if (result.error || !result.id) {
        setError(result.error ?? "Не удалось добавить");
        setPendingStatus(null);
        return;
      }
      toast.show({
        message: `«${movie.title}» добавлен в «${LABELS[status].tab}»`,
      });
      router.replace(`/movies/${result.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {order.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => handleAdd(status)}
            disabled={isPending}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              status === preferred
                ? "bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {pendingStatus === status && <Spinner />}
            {LABELS[status].button}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
