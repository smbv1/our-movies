"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setStatus } from "@/app/movies/actions";
import FilterSelect from "@/components/FilterSelect";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import {
  capitalize,
  formatRuntime,
  LENGTHS,
  tmdbImage,
  type LengthKey,
  type MediaType,
  type Movie,
} from "@/lib/types";

type RandomPickProps = {
  movies: Movie[];
  nameById: Record<string, string>;
  memberCount: number;
  // Open with a pick right away (the «Что смотрим сегодня?» app shortcut).
  autoOpen?: boolean;
};

type Kind = "all" | MediaType;

const KIND_LABELS: Record<Kind, string> = {
  all: "Всё",
  movie: "Фильм",
  tv: "Сериал",
};

// What the pick is limited to. Kept on the device, so tonight's choice sticks.
type Conditions = {
  // Only titles both partners marked «хочу».
  bothOnly: boolean;
  kind: Kind;
  length: "all" | LengthKey;
  genre: string;
};

const DEFAULT_CONDITIONS: Conditions = {
  bothOnly: false,
  kind: "all",
  length: "all",
  genre: "all",
};

const STORAGE_KEY = "random-pick-conditions";

function loadConditions(): Conditions {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return { ...DEFAULT_CONDITIONS, ...saved };
  } catch {
    return DEFAULT_CONDITIONS;
  }
}

function saveConditions(conditions: Conditions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conditions));
  } catch {
    // Private mode or storage full: the choice just won't be remembered.
  }
}

// Picks a random movie from the pool, avoiding the current one when there is a choice.
function pickFrom(pool: Movie[], currentId: string | null): Movie | undefined {
  const others = pool.length > 1 ? pool.filter((m) => m.id !== currentId) : pool;
  return others[Math.floor(Math.random() * others.length)];
}

const byTitle = new Intl.Collator("ru");

export default function RandomPick({
  movies,
  nameById,
  memberCount,
  autoOpen = false,
}: RandomPickProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Conditions>(DEFAULT_CONDITIONS);
  // Set when the remembered conditions matched nothing and were dropped.
  const [wasReset, setWasReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const bothWant = (m: Movie) => m.wanted_by.length >= memberCount;
  const matches = (m: Movie, c: Conditions) =>
    (c.kind === "all" || m.media_type === c.kind) &&
    (!c.bothOnly || bothWant(m)) &&
    // Titles whose length TMDB doesn't know never pass a length condition.
    (c.length === "all" || (m.runtime !== null && LENGTHS[c.length].test(m.runtime))) &&
    (c.genre === "all" || (m.genres ?? []).includes(c.genre));
  const poolFor = (c: Conditions) => movies.filter((m) => matches(m, c));
  // How many titles a tweak to the current conditions would leave.
  const countWith = (change: Partial<Conditions>) =>
    poolFor({ ...conditions, ...change }).length;
  const pool = poolFor(conditions);

  const canPickBoth = memberCount > 1 && movies.some(bothWant);
  const hasBothKinds =
    movies.some((m) => m.media_type === "tv") &&
    movies.some((m) => m.media_type === "movie");
  const hasRuntimes = movies.some((m) => m.runtime);
  const genreOptions = [...new Set(movies.flatMap((m) => m.genres ?? []))].sort(
    byTitle.compare,
  );

  const movie = movies.find((m) => m.id === pickedId);
  const isOpen = movie !== undefined;

  function close() {
    setPickedId(null);
    setError(null);
    setWasReset(false);
  }

  function roll(from: Movie[] = pool) {
    setError(null);
    setPickedId(pickFrom(from, pickedId)?.id ?? null);
  }

  // Opens the dialog with the conditions remembered from last time.
  function openPicker() {
    let saved = loadConditions();
    const reset = poolFor(saved).length === 0;
    if (reset) saved = DEFAULT_CONDITIONS;
    setConditions(saved);
    setWasReset(reset);
    roll(poolFor(saved));
  }

  function changeConditions(change: Partial<Conditions>) {
    const next = { ...conditions, ...change };
    setConditions(next);
    setWasReset(false);
    saveConditions(next);
    const nextPool = poolFor(next);
    if (movie && !nextPool.includes(movie)) roll(nextPool);
  }

  // The app shortcut lands on /?pick=1; open once and drop the flag from the address.
  useEffect(() => {
    if (!autoOpen) return;
    // After the first paint, so the list shows under the dialog.
    const frame = requestAnimationFrame(() => {
      window.history.replaceState(null, "", "/");
      openPicker();
    });
    return () => cancelAnimationFrame(frame);
    // Only on the first render: later renders must not reopen the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPickedId(null);
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
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
      toast.show({ message: `«${movie.title}» → в «Посмотрели»` });
    });
  }

  const isEmpty = movies.length === 0;
  if (isEmpty) return null;

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="group flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-400/15 via-rose-500/10 to-transparent p-4 text-left ring-1 ring-amber-400/20 transition hover:ring-amber-400/50"
      >
        <span
          aria-hidden
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-amber-400 text-2xl shadow-lg shadow-amber-500/20 transition group-hover:rotate-12"
        >
          🎲
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-zinc-50">Что смотрим сегодня?</span>
          <span className="block text-xs text-zinc-400">
            Случайный выбор: можно только общее, покороче или по жанру
          </span>
        </span>
      </button>

      {movie && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="random-pick-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <div role="group" aria-label="Из чего выбирать" className="flex flex-col gap-2 p-4 pb-0">
              {(hasBothKinds || canPickBoth) && (
                <div className="flex gap-1">
                  {canPickBoth && (
                    <button
                      type="button"
                      aria-pressed={conditions.bothOnly}
                      onClick={() => changeConditions({ bothOnly: !conditions.bothOnly })}
                      disabled={!conditions.bothOnly && countWith({ bothOnly: true }) === 0}
                      className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        conditions.bothOnly
                          ? "bg-rose-500 text-white"
                          : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
                      } disabled:opacity-40`}
                    >
                      ♥ Оба хотят
                    </button>
                  )}
                  {hasBothKinds && (Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={conditions.kind === k}
                      onClick={() => changeConditions({ kind: k })}
                      disabled={countWith({ kind: k }) === 0}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        conditions.kind === k
                          ? "bg-zinc-100 text-zinc-900"
                          : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
                      } disabled:opacity-40`}
                    >
                      {KIND_LABELS[k]}
                    </button>
                  ))}
                </div>
              )}
              {(hasRuntimes || genreOptions.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {hasRuntimes && (
                    <FilterSelect
                      label="Длительность"
                      value={conditions.length}
                      onChange={(value) =>
                        changeConditions({ length: value as Conditions["length"] })
                      }
                      highlight
                      options={[
                        ["all", "Любая длина"],
                        ...(Object.keys(LENGTHS) as LengthKey[]).map(
                          (key): [string, string, boolean] => [
                            key,
                            LENGTHS[key].label,
                            countWith({ length: key }) === 0,
                          ],
                        ),
                      ]}
                    />
                  )}
                  {genreOptions.length > 0 && (
                    <FilterSelect
                      label="Жанр"
                      value={conditions.genre}
                      onChange={(value) => changeConditions({ genre: value })}
                      highlight
                      options={[
                        ["all", "Любой жанр"],
                        ...genreOptions.map((g): [string, string, boolean] => [
                          g,
                          capitalize(g),
                          countWith({ genre: g }) === 0,
                        ]),
                      ]}
                    />
                  )}
                  <span className="ml-auto text-xs tabular-nums text-zinc-500">
                    {pool.length === movies.length
                      ? `из всех ${movies.length}`
                      : `из ${pool.length} из ${movies.length}`}
                  </span>
                </div>
              )}
              {wasReset && (
                <p className="text-xs text-zinc-500">
                  Под прошлые условия ничего не нашлось, выбираю из всего списка.
                </p>
              )}
            </div>

            {/* Keyed by movie so every new pick replays the pop-in animation. */}
            <div key={movie.id} className="animate-pop-in flex gap-4 p-4">
              {movie.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tmdbImage(movie.poster_path, "w342")}
                  alt={movie.title}
                  className="aspect-[2/3] w-32 shrink-0 rounded-lg object-cover shadow-lg shadow-black/50"
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
                  {[
                    movie.media_type === "tv" ? "Сериал" : null,
                    movie.year ?? "год неизвестен",
                    movie.runtime
                      ? `${formatRuntime(movie.runtime)}${movie.media_type === "tv" ? " серия" : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {movie.genres && movie.genres.length > 0 && (
                  <p className="text-xs text-zinc-500">
                    {capitalize(movie.genres.slice(0, 3).join(", "))}
                  </p>
                )}
                <p className="text-xs text-zinc-500">
                  добавил(а): {nameById[movie.added_by] ?? "неизвестно"}
                </p>
                <Link
                  href={`/movies/${movie.id}`}
                  className="mt-1 w-fit text-xs text-amber-400 hover:text-amber-300"
                >
                  Подробнее, трейлер и где смотреть →
                </Link>
              </div>
            </div>

            {movie.overview && (
              <p className="line-clamp-5 px-4 text-sm leading-relaxed text-zinc-400">
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
                onClick={handleWatched}
                disabled={isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 sm:order-2"
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
                onClick={() => roll()}
                disabled={isPending || pool.length < 2}
                className="flex-1 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
              >
                🎲 Другой
              </button>
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50 sm:order-3"
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
