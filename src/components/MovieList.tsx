"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { deleteMovie, setStatus, setWant } from "@/app/movies/actions";
import EmptyState from "@/components/EmptyState";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import MovieCard from "@/components/MovieCard";
import { useToast } from "@/components/Toaster";
import type { MediaType, Movie, MovieStatus } from "@/lib/types";

type MovieListProps = {
  // Everything in the current tab.
  movies: Movie[];
  members: Member[];
  // The signed-in member, whose «хочу» mark the heart button toggles.
  meId: string;
  tab: MovieStatus;
};

type TypeFilter = "all" | MediaType;
// "both": everyone wants it; a member id: only that member wants it.
type WantFilter = "all" | "both" | string;
type SortKey = "added" | "wanted" | "watched" | "year" | "title";

const SORT_LABELS: Record<SortKey, string> = {
  added: "Сначала новые",
  wanted: "Сначала общие",
  watched: "По дате просмотра",
  year: "По году выхода",
  title: "По названию",
};

// Cards that the current tab shows above the fold: loaded first, the rest lazily.
const EAGER_COUNT = 4;

const byTitle = new Intl.Collator("ru");

function sortMovies(movies: Movie[], key: SortKey): Movie[] {
  const sorted = [...movies];
  switch (key) {
    case "added":
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "wanted":
      return sorted.sort(
        (a, b) =>
          b.wanted_by.length - a.wanted_by.length ||
          b.created_at.localeCompare(a.created_at),
      );
    case "watched":
      return sorted.sort((a, b) =>
        (b.watched_at ?? "").localeCompare(a.watched_at ?? ""),
      );
    case "year":
      return sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    case "title":
      return sorted.sort((a, b) => byTitle.compare(a.title, b.title));
  }
}

function focusSearch() {
  const input = document.getElementById("movie-search");
  input?.scrollIntoView({ block: "center", behavior: "smooth" });
  input?.focus();
}

export default function MovieList({ movies, members, meId, tab }: MovieListProps) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [adderFilter, setAdderFilter] = useState<string>("all");
  const [wantFilter, setWantFilter] = useState<WantFilter>("all");
  // «Кто хочет» only matters for titles still to watch, and only in a pair.
  const showWants = tab === "want" && members.length > 1;
  // The watched tab reads best by when you watched it; the want tab by when it was added.
  const [sortByTab, setSortByTab] = useState<Record<MovieStatus, SortKey>>({
    want: "added",
    watched: "watched",
  });
  const sort = sortByTab[tab];

  // A card leaves the tab as soon as its status changes or it is deleted. If the
  // action fails, the transition ends and the card comes back.
  const [leavingIds, markLeaving] = useOptimistic(
    new Set<string>(),
    (ids, id: string) => new Set(ids).add(id),
  );
  // A tapped heart shows at once; it goes back if saving fails.
  const [wantOverrides, overrideWant] = useOptimistic(
    {} as Record<string, string[]>,
    (overrides, change: { id: string; wantedBy: string[] }) => ({
      ...overrides,
      [change.id]: change.wantedBy,
    }),
  );
  // Deleted cards wait here while the "Отменить" toast is up.
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const indexById = useMemo(
    () => Object.fromEntries(members.map((m, i) => [m.id, i])),
    [members],
  );
  const nameById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.display_name])),
    [members],
  );

  const isGone = (id: string) => leavingIds.has(id) || deletingIds.has(id);
  const present = movies
    .filter((m) => !isGone(m.id))
    .map((m) =>
      wantOverrides[m.id] ? { ...m, wanted_by: wantOverrides[m.id] } : m,
    );
  // Each tab shows only its own person filter; the other one's choice is kept but not applied.
  const adderActive = !showWants && adderFilter !== "all";
  const wantActive = showWants && wantFilter !== "all";
  const matchesWant = (m: Movie) =>
    wantFilter === "both"
      ? members.every((p) => m.wanted_by.includes(p.id))
      : m.wanted_by.length === 1 && m.wanted_by[0] === wantFilter;
  const filtered = sortMovies(
    present.filter(
      (m) =>
        (typeFilter === "all" || m.media_type === typeFilter) &&
        (!adderActive || m.added_by === adderFilter) &&
        (!wantActive || matchesWant(m)),
    ),
    sort,
  );
  const isFiltered = typeFilter !== "all" || adderActive || wantActive;

  function toggleWant(movie: Movie) {
    const wants = !movie.wanted_by.includes(meId);
    const wantedBy = wants
      ? [...movie.wanted_by, meId]
      : movie.wanted_by.filter((id) => id !== meId);
    startTransition(async () => {
      overrideWant({ id: movie.id, wantedBy });
      const result = await setWant(movie.id, wants);
      if (result.error) toast.show({ message: result.error, tone: "error" });
    });
  }

  function changeStatus(movie: Movie, next: MovieStatus) {
    startTransition(async () => {
      markLeaving(movie.id);
      const result = await setStatus(movie.id, next);
      if (result.error) {
        toast.show({ message: result.error, tone: "error" });
        return;
      }
      const prev = movie.status;
      toast.show({
        message:
          next === "watched"
            ? `«${movie.title}» → в «Посмотрели»`
            : `«${movie.title}» → снова в «Хотим»`,
        action: {
          label: "Отменить",
          onClick: () =>
            startTransition(async () => {
              const undo = await setStatus(movie.id, prev, movie.watched_at);
              if (undo.error) toast.show({ message: undo.error, tone: "error" });
            }),
        },
      });
    });
  }

  function forgetDeleting(id: string) {
    setDeletingIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  // The card hides at once; the row is only deleted when the toast expires unused.
  function remove(movie: Movie) {
    setDeletingIds((ids) => new Set(ids).add(movie.id));
    toast.show({
      message: `«${movie.title}» удалён из списка`,
      action: { label: "Отменить", onClick: () => forgetDeleting(movie.id) },
      onExpire: () =>
        startTransition(async () => {
          markLeaving(movie.id);
          const result = await deleteMovie(movie.id);
          forgetDeleting(movie.id);
          if (result.error) toast.show({ message: result.error, tone: "error" });
        }),
    });
  }

  if (present.length === 0) {
    return tab === "want" ? (
      <EmptyState
        icon="🍿"
        title="Пока нечего смотреть"
        hint="Найдите фильм или сериал в поиске сверху и добавьте его. Он появится здесь у вас обоих."
        action={
          <button
            type="button"
            onClick={focusSearch}
            className="mt-1 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Найти фильм
          </button>
        }
      />
    ) : (
      <EmptyState
        icon="🎬"
        title="Здесь будет ваша история"
        hint="Посмотрели что-то из «Хотим»? Нажмите ✓ на карточке, и фильм переедет сюда с датой просмотра."
      />
    );
  }

  const chipClass = (active: boolean) =>
    `inline-flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
      active
        ? "bg-zinc-100 text-zinc-900"
        : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-100"
    }`;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Shown on both tabs even when only one kind is there, so the bar looks the same. */}
        <div role="group" aria-label="Тип" className="flex gap-1.5">
          {(
            [
              ["all", "Все"],
              ["movie", "Фильмы"],
              ["tv", "Сериалы"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={typeFilter === value}
              onClick={() => setTypeFilter(value)}
              className={chipClass(typeFilter === value)}
            >
              {label}
            </button>
          ))}
        </div>

        {showWants && (
          <div role="group" aria-label="Кто хочет" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={wantFilter === "both"}
              onClick={() => setWantFilter(wantFilter === "both" ? "all" : "both")}
              title="Хотят оба"
              className={chipClass(wantFilter === "both")}
            >
              <span aria-hidden className="text-rose-400">♥</span>
              Оба хотят
            </button>
            {members.map((m, i) => {
              const active = wantFilter === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setWantFilter(active ? "all" : m.id)}
                  title={`Хочет только ${m.display_name}`}
                  className={chipClass(active)}
                >
                  <MemberAvatar name={m.display_name} index={i} size="xs" />
                  Только {m.display_name}
                </button>
              );
            })}
          </div>
        )}

        {members.length > 1 && !showWants && (
          <div role="group" aria-label="Кто добавил" className="flex gap-1.5">
            {members.map((m, i) => {
              const active = adderFilter === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAdderFilter(active ? "all" : m.id)}
                  title={`Добавил(а) ${m.display_name}`}
                  className={chipClass(active)}
                >
                  <MemberAvatar name={m.display_name} index={i} size="xs" />
                  {m.display_name}
                </button>
              );
            })}
          </div>
        )}

        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <span className="sr-only sm:not-sr-only">Сортировка</span>
          {/* Native arrows sit flush against the rounded edge on desktop; draw our own. */}
          <span className="relative flex items-center">
            <select
              value={sort}
              onChange={(e) =>
                setSortByTab((s) => ({
                  ...s,
                  [tab]: e.target.value as SortKey,
                }))
              }
              className="h-8 appearance-none rounded-full border-0 bg-zinc-900 pl-3 pr-8 text-xs text-zinc-200 ring-1 ring-zinc-800 outline-none focus:ring-amber-500/50"
            >
              {(Object.keys(SORT_LABELS) as SortKey[])
                .filter(
                  (key) =>
                    (key !== "watched" || tab === "watched") &&
                    (key !== "wanted" || showWants),
                )
                .map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
            </select>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
              className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-zinc-400"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </label>
      </div>

      {filtered.length === 0 && isFiltered && (
        <EmptyState
          icon="🔍"
          title="Под фильтр ничего не подошло"
          action={
            <button
              type="button"
              onClick={() => {
                setTypeFilter("all");
                setAdderFilter("all");
                setWantFilter("all");
              }}
              className="mt-1 rounded-lg px-4 py-2 text-sm font-medium text-amber-400 ring-1 ring-amber-400/40 transition hover:bg-amber-400/10"
            >
              Сбросить фильтры
            </button>
          }
        />
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((movie, i) => (
          <li key={movie.id}>
            <MovieCard
              movie={movie}
              addedByName={nameById[movie.added_by] ?? "?"}
              addedByIndex={indexById[movie.added_by] ?? -1}
              eager={i < EAGER_COUNT}
              wanters={
                showWants
                  ? members
                      .map((m, index) => ({ ...m, index }))
                      .filter((m) => movie.wanted_by.includes(m.id))
                  : undefined
              }
              iWant={movie.wanted_by.includes(meId)}
              bothWant={members.every((m) => movie.wanted_by.includes(m.id))}
              onToggleWant={() => toggleWant(movie)}
              onToggleStatus={() =>
                changeStatus(
                  movie,
                  movie.status === "want" ? "watched" : "want",
                )
              }
              onDelete={() => remove(movie)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
