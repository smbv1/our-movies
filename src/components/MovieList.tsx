"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  deleteMovie,
  setRating,
  setStatus,
  setWant,
} from "@/app/movies/actions";
import EmptyState from "@/components/EmptyState";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import MovieCard from "@/components/MovieCard";
import { useToast } from "@/components/Toaster";
import {
  averageRating,
  ratingVerdict,
  type MediaType,
  type Movie,
  type MovieStatus,
} from "@/lib/types";

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
type SortKey = "added" | "wanted" | "watched" | "rating" | "year" | "title";

const SORT_LABELS: Record<SortKey, string> = {
  added: "Сначала новые",
  wanted: "Сначала общие",
  watched: "По дате просмотра",
  rating: "По нашей оценке",
  year: "По году выхода",
  title: "По названию",
};

// Length buckets in minutes; a series is judged by one episode.
const LENGTHS = {
  short: { label: "До 1,5 ч", test: (min: number) => min <= 90 },
  medium: { label: "До 2 ч", test: (min: number) => min <= 120 },
  long: { label: "Дольше 2 ч", test: (min: number) => min > 120 },
} as const;
type LengthFilter = "all" | keyof typeof LENGTHS;

// "match" / "apart": both rated and agreed or split; "unrated": I haven't rated it yet.
type RatingFilter = "all" | "match" | "apart" | "unrated";
const RATING_FILTER_LABELS: Record<Exclude<RatingFilter, "all">, string> = {
  match: "Совпали",
  apart: "Разошлись",
  unrated: "Я не оценил(а)",
};

// Decades as their first year: 2010 means 2010–2019.
function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

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
    case "rating":
      return sorted.sort(
        (a, b) =>
          (averageRating(b.ratings) ?? -1) - (averageRating(a.ratings) ?? -1) ||
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
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [lengthFilter, setLengthFilter] = useState<LengthFilter>("all");
  const [decadeFilter, setDecadeFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  // Scores show on watched titles only.
  const showRatings = tab === "watched";
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
  // A picked score shows at once; it goes back if saving fails.
  const [ratingOverrides, overrideRatings] = useOptimistic(
    {} as Record<string, Record<string, number>>,
    (overrides, change: { id: string; ratings: Record<string, number> }) => ({
      ...overrides,
      [change.id]: change.ratings,
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
  // Me first, so my score sits next to the "Оценить" button.
  const raters = useMemo(
    () =>
      members
        .map((m, index) => ({ ...m, index }))
        .sort((a, b) => Number(b.id === meId) - Number(a.id === meId)),
    [members, meId],
  );

  const isGone = (id: string) => leavingIds.has(id) || deletingIds.has(id);
  const present = movies
    .filter((m) => !isGone(m.id))
    .map((m) => ({
      ...m,
      wanted_by: wantOverrides[m.id] ?? m.wanted_by,
      ratings: ratingOverrides[m.id] ?? m.ratings,
    }));
  // Only genres and decades that something in this tab has, most common genres first.
  const genreOptions = countBy(present.flatMap((m) => m.genres ?? []));
  const decadeOptions = [
    ...new Set(
      present.flatMap((m) => (m.year ? [decadeOf(m.year)] : [])),
    ),
  ].sort((a, b) => b - a);
  const hasRuntimes = present.some((m) => m.runtime);
  // A choice that this tab has nothing for (say, after switching tabs) is kept but not applied.
  const genre = genreOptions.includes(genreFilter) ? genreFilter : "all";
  const decade = decadeOptions.includes(Number(decadeFilter)) ? decadeFilter : "all";
  const length = hasRuntimes ? lengthFilter : "all";
  const showExtraFilters =
    genreOptions.length > 0 || hasRuntimes || decadeOptions.length > 1 || showRatings;
  // Each tab shows only its own person filter; the other one's choice is kept but not applied.
  const adderActive = !showWants && adderFilter !== "all";
  const wantActive = showWants && wantFilter !== "all";
  const matchesWant = (m: Movie) =>
    wantFilter === "both"
      ? members.every((p) => m.wanted_by.includes(p.id))
      : m.wanted_by.length === 1 && m.wanted_by[0] === wantFilter;
  const ratingActive = showRatings && ratingFilter !== "all";
  const matchesRating = (m: Movie) => {
    if (ratingFilter === "unrated") return m.ratings[meId] === undefined;
    const scores = members.map((p) => m.ratings[p.id]);
    // Agreement only counts once everyone in the pair has rated.
    if (scores.some((n) => n === undefined)) return false;
    return ratingVerdict(scores) === ratingFilter;
  };
  const filtered = sortMovies(
    present.filter(
      (m) =>
        (typeFilter === "all" || m.media_type === typeFilter) &&
        (!adderActive || m.added_by === adderFilter) &&
        (!wantActive || matchesWant(m)) &&
        (genre === "all" || (m.genres ?? []).includes(genre)) &&
        (length === "all" ||
          (m.runtime !== null && LENGTHS[length].test(m.runtime))) &&
        (decade === "all" ||
          (m.year !== null && decadeOf(m.year) === Number(decade))) &&
        (!ratingActive || matchesRating(m)),
    ),
    sort,
  );
  const isFiltered =
    typeFilter !== "all" ||
    adderActive ||
    wantActive ||
    genre !== "all" ||
    length !== "all" ||
    decade !== "all" ||
    ratingActive;

  function resetFilters() {
    setTypeFilter("all");
    setAdderFilter("all");
    setWantFilter("all");
    setGenreFilter("all");
    setLengthFilter("all");
    setDecadeFilter("all");
    setRatingFilter("all");
  }

  function rate(movie: Movie, score: number | null) {
    const ratings = { ...movie.ratings };
    if (score === null) delete ratings[meId];
    else ratings[meId] = score;
    startTransition(async () => {
      overrideRatings({ id: movie.id, ratings });
      const result = await setRating(movie.id, score);
      if (result.error) toast.show({ message: result.error, tone: "error" });
    });
  }

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
          <FilterSelect
            value={sort}
            onChange={(value) =>
              setSortByTab((s) => ({ ...s, [tab]: value as SortKey }))
            }
            options={(Object.keys(SORT_LABELS) as SortKey[])
              .filter(
                (key) =>
                  (key !== "watched" || tab === "watched") &&
                  (key !== "rating" || showRatings) &&
                  (key !== "wanted" || showWants),
              )
              .map((key) => [key, SORT_LABELS[key]])}
          />
        </label>
      </div>

      {/* Genre, length, decade and (on «Посмотрели») ratings. Highlighted while in use. */}
      {showExtraFilters && (
        // One swipeable row on phones, so four selects don't push the list down.
        <div className="-mx-4 -mt-1 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {genreOptions.length > 0 && (
            <FilterSelect
              label="Жанр"
              value={genre}
              onChange={setGenreFilter}
              highlight
              options={[
                ["all", "Все жанры"],
                ...genreOptions.map((g): [string, string] => [g, capitalize(g)]),
              ]}
            />
          )}
          {hasRuntimes && (
            <FilterSelect
              label="Длительность"
              value={length}
              onChange={(value) => setLengthFilter(value as LengthFilter)}
              highlight
              options={[
                ["all", "Любая длина"],
                ...(Object.keys(LENGTHS) as (keyof typeof LENGTHS)[]).map(
                  (key): [string, string] => [key, LENGTHS[key].label],
                ),
              ]}
            />
          )}
          {decadeOptions.length > 1 && (
            <FilterSelect
              label="Годы"
              value={decade}
              onChange={setDecadeFilter}
              highlight
              options={[
                ["all", "Любые годы"],
                ...decadeOptions.map((d): [string, string] => [
                  String(d),
                  d < 1970 ? `${d}-е` : `${String(d).slice(2)}-е`,
                ]),
              ]}
            />
          )}
          {showRatings && (
            <FilterSelect
              label="Оценки"
              value={ratingFilter}
              onChange={(value) => setRatingFilter(value as RatingFilter)}
              highlight
              options={[
                ["all", "Все оценки"],
                ...(
                  Object.keys(RATING_FILTER_LABELS) as (keyof typeof RATING_FILTER_LABELS)[]
                )
                  .filter((key) => key === "unrated" || members.length > 1)
                  .map((key): [string, string] => [key, RATING_FILTER_LABELS[key]]),
              ]}
            />
          )}
          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-8 flex-none px-2 text-xs text-zinc-500 transition hover:text-zinc-200"
            >
              Сбросить
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 && isFiltered && (
        <EmptyState
          icon="🔍"
          title="Под фильтр ничего не подошло"
          action={
            <button
              type="button"
              onClick={resetFilters}
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
              raters={showRatings ? raters : undefined}
              meId={meId}
              onRate={(score) => rate(movie, score)}
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

// Distinct values, most frequent first, ties alphabetically.
function countBy(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.keys()].sort(
    (a, b) => counts.get(b)! - counts.get(a)! || byTitle.compare(a, b),
  );
}

// TMDB's Russian genre names are lowercase ("боевик").
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: [value: string, label: string][];
  // Accessible name, for selects without a visible label.
  label?: string;
  // Light up while set to anything but the first option.
  highlight?: boolean;
};

// A pill-shaped native select; native arrows sit flush against the rounded edge on desktop, so it draws its own.
function FilterSelect({ value, onChange, options, label, highlight = false }: FilterSelectProps) {
  const active = highlight && value !== options[0]?.[0];
  return (
    <span className="relative flex flex-none items-center">
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 max-w-[11rem] appearance-none truncate rounded-full border-0 pl-3 pr-8 text-xs ring-1 outline-none focus:ring-amber-500/50 ${
          active
            ? "bg-zinc-100 font-medium text-zinc-900 ring-zinc-100"
            : "bg-zinc-900 text-zinc-200 ring-zinc-800"
        }`}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
        className={`pointer-events-none absolute right-2.5 h-3.5 w-3.5 ${
          active ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}
