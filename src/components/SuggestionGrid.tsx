"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addMovie } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import {
  posterSrcSet,
  searchKey,
  tmdbImage,
  type MediaType,
  type MovieStatus,
  type SearchResult,
} from "@/lib/types";

export type Suggestion = {
  movie: SearchResult;
  // A line under the title: why it is suggested, or the role played.
  note?: string;
};

type SuggestionGridProps = {
  items: Suggestion[];
  // What is already in the list, keyed by `${media_type}-${tmdb_id}`.
  existing: Record<string, MovieStatus>;
  // Status new titles get: the tab the page was opened from.
  addAs: MovieStatus;
  // Shows «Все / Фильмы / Сериалы» chips when both kinds are present.
  typeFilter?: boolean;
};

type TypeKey = "all" | MediaType;

const TYPE_LABELS: Record<TypeKey, string> = {
  all: "Все",
  movie: "Фильмы",
  tv: "Сериалы",
};

// Titles from TMDB that are not ours yet, each with a one-tap add.
export default function SuggestionGrid({
  items,
  existing,
  addAs,
  typeFilter = false,
}: SuggestionGridProps) {
  const toast = useToast();
  // Added here before the server data catches up, so the button flips at once.
  const [added, setAdded] = useState<Record<string, MovieStatus>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [type, setType] = useState<TypeKey>("all");

  const hasBoth =
    items.some((i) => i.movie.media_type === "movie") &&
    items.some((i) => i.movie.media_type === "tv");
  const shown =
    typeFilter && hasBoth && type !== "all"
      ? items.filter((i) => i.movie.media_type === type)
      : items;

  function handleAdd(movie: SearchResult) {
    const key = searchKey(movie);
    setPendingKey(key);
    startTransition(async () => {
      const result = await addMovie(movie, addAs);
      setPendingKey(null);
      if (result.error) {
        toast.show({ message: `«${movie.title}»: ${result.error}`, tone: "error" });
        return;
      }
      setAdded((prev) => ({ ...prev, [key]: addAs }));
      const tabName = addAs === "watched" ? "Посмотрели" : "Хотим";
      toast.show({ message: `«${movie.title}» добавлен в «${tabName}»` });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {typeFilter && hasBoth && (
        <div role="group" aria-label="Тип" className="flex gap-2">
          {(Object.keys(TYPE_LABELS) as TypeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              aria-pressed={type === key}
              className={`rounded-full px-3 py-1 text-sm transition ${
                type === key
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-100"
              }`}
            >
              {TYPE_LABELS[key]}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {shown.map(({ movie, note }, index) => {
          const key = searchKey(movie);
          const status = added[key] ?? existing[key];
          const href = `/title/${movie.media_type}/${movie.tmdb_id}?tab=${addAs}`;
          return (
            <li key={key} className="group flex flex-col gap-2">
              <Link
                href={href}
                aria-label={`Подробнее: ${movie.title}`}
                className="block overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5 transition group-hover:ring-amber-400/40"
              >
                {movie.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tmdbImage(movie.poster_path, "w342")}
                    srcSet={posterSrcSet(movie.poster_path)}
                    sizes="(min-width: 1024px) 220px, (min-width: 640px) 25vw, 45vw"
                    alt=""
                    loading={index < 5 ? "eager" : "lazy"}
                    className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-end bg-gradient-to-br from-zinc-800 to-zinc-900 p-3">
                    <span className="line-clamp-4 text-sm font-semibold text-zinc-400">
                      {movie.title}
                    </span>
                  </div>
                )}
              </Link>
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={href}
                  className="line-clamp-2 text-sm font-medium leading-snug text-zinc-100 hover:text-amber-300"
                >
                  {movie.title}
                </Link>
                <p className="text-xs text-zinc-500">
                  {movie.media_type === "tv" ? "Сериал" : "Фильм"}
                  {movie.year ? ` · ${movie.year}` : ""}
                </p>
                {note && (
                  <p className="line-clamp-2 text-xs text-zinc-400">{note}</p>
                )}
              </div>
              {status ? (
                <span className="mt-auto rounded-lg px-3 py-1.5 text-center text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/30">
                  {status === "watched" ? "Уже смотрели" : "В «Хотим»"}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAdd(movie)}
                  disabled={pendingKey !== null}
                  aria-label={`Добавить «${movie.title}» в «${addAs === "watched" ? "Посмотрели" : "Хотим"}»`}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingKey === key && <Spinner />}
                  {addAs === "watched" ? "✓ Смотрели" : "+ Хотим"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
