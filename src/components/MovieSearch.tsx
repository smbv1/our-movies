"use client";

import { useEffect, useState, useTransition } from "react";
import { addMovie } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import { tmdbImage, type SearchResult } from "@/lib/types";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export default function MovieSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addingTitle, setAddingTitle] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = query.trim();
  const isActive = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isActive) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Ошибка поиска ${res.status}`);
        }
        const data = (await res.json()) as SearchResult[];
        setResults(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearchError(
          err instanceof Error && err.message
            ? err.message
            : "Не удалось найти фильмы. Попробуйте ещё раз.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, isActive]);

  // Results are only shown for the current query, so no state reset is needed for short input.
  const visibleResults = isActive ? results : [];

  // Results close at once instead of after the save; the card shows up when the list re-renders.
  function handleAdd(movie: SearchResult) {
    setActionError(null);
    setAddingTitle(movie.title);
    setQuery("");
    setResults([]);
    startTransition(async () => {
      const result = await addMovie(movie);
      setAddingTitle(null);
      if (result.error) setActionError(`«${movie.title}»: ${result.error}`);
    });
  }

  return (
    <section className="w-full">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActionError(null);
          }}
          placeholder="Найти фильм…"
          aria-label="Найти фильм"
          autoComplete="off"
          className={`h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-base text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 ${
            loading ? "pr-12" : ""
          }`}
        />
        {loading && (
          <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
            <Spinner label="Поиск" />
          </div>
        )}
      </div>

      {isPending && addingTitle && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 text-sm text-zinc-400"
        >
          <Spinner />
          Добавляем «{addingTitle}»…
        </p>
      )}

      {actionError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {actionError}
        </p>
      )}

      {isActive && (loading || searchError || visibleResults.length > 0) && (
        <ul className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {loading && visibleResults.length === 0 && (
            <li className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-zinc-500">
              <Spinner />
              Ищем…
            </li>
          )}
          {searchError && (
            <li className="px-4 py-6 text-center text-sm text-red-400">
              {searchError}
            </li>
          )}
          {visibleResults.map((movie) => (
            <li
              key={movie.tmdb_id}
              className="flex items-center gap-3 p-3"
            >
              {movie.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tmdbImage(movie.poster_path, "w92")}
                  alt=""
                  loading="lazy"
                  className="h-16 w-11 flex-none rounded-md object-cover"
                />
              ) : (
                <div className="flex h-16 w-11 flex-none items-center justify-center rounded-md bg-zinc-800 text-[10px] text-zinc-500">
                  нет фото
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {movie.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {movie.year ?? "год неизвестен"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAdd(movie)}
                disabled={isPending}
                className="inline-flex flex-none items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Добавить
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
