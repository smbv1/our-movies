"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addMovie } from "@/app/movies/actions";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import {
  DEPARTMENT_NAMES,
  searchKey,
  tmdbImage,
  type MovieStatus,
  type PersonResult,
  type SearchResponse,
  type SearchResult,
} from "@/lib/types";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

type MovieSearchProps = {
  // What is already in the list, keyed by `${media_type}-${tmdb_id}`.
  existing: Record<string, MovieStatus>;
  // New titles go into the tab that is open, so adding from «Посмотрели» marks them watched.
  addAs: MovieStatus;
};

export default function MovieSearch({ existing, addAs }: MovieSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [people, setPeople] = useState<PersonResult[]>([]);
  // The query the current results belong to, to tell "nothing found" from "not searched yet".
  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLElement>(null);
  const toast = useToast();

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
        // A response the browser cached before people were added is a bare array.
        const data = (await res.json()) as SearchResponse | SearchResult[];
        setResults(Array.isArray(data) ? data : data.titles);
        setPeople(Array.isArray(data) ? [] : data.people);
        setResultsFor(trimmed);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setPeople([]);
        setResultsFor(null);
        setSearchError(
          err instanceof Error && err.message
            ? err.message
            : "Не удалось выполнить поиск. Попробуйте ещё раз.",
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

  // The results panel floats over the page; a tap outside it closes it.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Results are only shown for the current query, so no state reset is needed for short input.
  const visibleResults = isActive ? results : [];
  const visiblePeople = isActive ? people : [];
  const nothingFound =
    isActive &&
    !loading &&
    !searchError &&
    resultsFor === trimmed &&
    results.length === 0 &&
    people.length === 0;
  const showPanel =
    open &&
    isActive &&
    (loading ||
      !!searchError ||
      nothingFound ||
      visibleResults.length > 0 ||
      visiblePeople.length > 0);

  // Results close at once instead of after the save; the card shows up when the list re-renders.
  function handleAdd(movie: SearchResult) {
    setQuery("");
    setResults([]);
    setPeople([]);
    setOpen(false);
    startTransition(async () => {
      const result = await addMovie(movie, addAs);
      if (result.error) {
        toast.show({ message: `«${movie.title}»: ${result.error}`, tone: "error" });
      } else {
        const tabName = addAs === "watched" ? "Посмотрели" : "Хотим";
        toast.show({ message: `«${movie.title}» добавлен в «${tabName}»` });
      }
    });
  }

  return (
    <section ref={rootRef} className="relative w-full">
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-500"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 3.47 9.77l3.63 3.63a.75.75 0 1 0 1.06-1.06l-3.63-3.63A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <input
          id="movie-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setOpen(false);
            }
          }}
          placeholder={
            addAs === "watched"
              ? "Добавить в «Посмотрели»…"
              : "Фильм, сериал или актёр…"
          }
          aria-label="Найти фильм, сериал, актёра или режиссёра"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-10 pr-11 text-base text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20"
        />
        {(loading || isPending) && (
          <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
            <Spinner label={isPending ? "Добавляем" : "Поиск"} />
          </div>
        )}
      </div>

      {showPanel && (
        <ul className="animate-fade-in absolute inset-x-0 top-full z-40 mt-2 max-h-[min(65vh,32rem)] divide-y divide-zinc-800 overflow-y-auto overscroll-contain rounded-xl border border-zinc-700/60 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur">
          {loading && visibleResults.length === 0 && visiblePeople.length === 0 && (
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
          {nothingFound && (
            <li className="px-4 py-6 text-center text-sm text-zinc-400">
              Ничего не нашли по запросу «{trimmed}».
              <span className="mt-1 block text-xs text-zinc-500">
                Попробуйте другое написание или оригинальное название.
              </span>
            </li>
          )}
          {visiblePeople.map((person) => (
            <li key={`person-${person.tmdb_id}`} className="p-3">
              <Link
                href={`/person/${person.tmdb_id}?tab=${addAs}`}
                onClick={() => setOpen(false)}
                className="-m-1 flex min-w-0 items-center gap-3 rounded-lg p-1 transition hover:bg-zinc-800/60"
              >
                {person.profile_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tmdbImage(person.profile_path, "w92")}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 flex-none rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-500">
                    👤
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {person.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {(person.department && DEPARTMENT_NAMES[person.department]) ??
                      "Персона"}
                    {person.known_for.length > 0 &&
                      ` · ${person.known_for.join(", ")}`}
                  </p>
                </div>
                <span className="flex-none text-xs text-amber-400">
                  Фильмография ›
                </span>
              </Link>
            </li>
          ))}
          {visibleResults.map((movie) => {
            const status = existing[searchKey(movie)];
            return (
              <li key={searchKey(movie)} className="flex items-center gap-3 p-3">
                {/* Opens the title's page to read more first; titles already in the list land on their own page. */}
                <Link
                  href={`/title/${movie.media_type}/${movie.tmdb_id}?tab=${addAs}`}
                  onClick={() => setOpen(false)}
                  className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 transition hover:bg-zinc-800/60"
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
                      {movie.media_type === "tv" ? "Сериал · " : "Фильм · "}
                      {movie.year ?? "год неизвестен"}
                      <span className="text-zinc-600"> · подробнее ›</span>
                    </p>
                  </div>
                </Link>
                {status ? (
                  <span className="flex-none rounded-lg px-3 py-2 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/30">
                    {status === "watched" ? "Уже смотрели" : "Уже в «Хотим»"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAdd(movie)}
                    disabled={isPending}
                    aria-label={`Добавить «${movie.title}» в «${addAs === "watched" ? "Посмотрели" : "Хотим"}»`}
                    className="inline-flex flex-none items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addAs === "watched" ? "✓ Смотрели" : "+ Хотим"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
