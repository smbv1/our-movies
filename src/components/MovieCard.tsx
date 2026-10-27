"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import { CardRating, type RatedMember } from "@/components/Ratings";
import { ProviderLogo } from "@/components/ServicesButton";
import { formatRuntime, posterSrcSet, tmdbImage, type Movie } from "@/lib/types";

type MovieCardProps = {
  movie: Movie;
  addedByName: string;
  // Position of the adder among the list's members; picks the avatar color.
  addedByIndex: number;
  // Load the poster right away instead of lazily (cards in the first row).
  eager?: boolean;
  // Members who want it, with their color index. Left out where «кто хочет» isn't shown.
  wanters?: (Member & { index: number })[];
  iWant?: boolean;
  bothWant?: boolean;
  onToggleWant?: () => void;
  // Members whose scores show under a watched title; left out on the «Хотим» tab.
  raters?: RatedMember[];
  meId?: string;
  onRate?: (score: number | null) => void;
  // Streaming services under the title, with the couple's own ones (ids) lit up.
  // Left out where they aren't shown.
  services?: number[];
  // Members' notes on the title with their color index, me first.
  notes?: (Member & { index: number; text: string })[];
  onToggleStatus: () => void;
  onDelete: () => void;
};

const watchedDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

export default function MovieCard({
  movie,
  addedByName,
  addedByIndex,
  eager = false,
  wanters,
  iWant = false,
  bothWant = false,
  onToggleWant,
  raters,
  meId = "",
  onRate,
  services,
  notes = [],
  onToggleStatus,
  onDelete,
}: MovieCardProps) {
  const isWatched = movie.status === "watched";
  const showWants = wanters !== undefined;
  const href = `/movies/${movie.id}`;

  return (
    <article className="group flex flex-col gap-2">
      <div className="relative rounded-xl bg-zinc-900 ring-1 ring-white/5 transition group-hover:ring-amber-400/40">
        {/* Clipping sits on the link, not the wrapper, so the menu can spill past the poster. */}
        <Link
          href={href}
          aria-label={`Подробнее: ${movie.title}`}
          className="block overflow-hidden rounded-xl"
        >
          {movie.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tmdbImage(movie.poster_path, "w342")}
              srcSet={posterSrcSet(movie.poster_path)}
              sizes="(min-width: 1024px) 220px, (min-width: 640px) 25vw, 45vw"
              alt=""
              loading={eager ? "eager" : "lazy"}
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

        {/* Darkens the poster's bottom so the round button stays visible on light posters. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-xl bg-gradient-to-t from-black/60 to-transparent" />

        {movie.media_type === "tv" && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-950">
            Сериал
          </span>
        )}

        <CardMenu
          title={movie.title}
          href={href}
          isWatched={isWatched}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />

        {showWants && (
          <button
            type="button"
            onClick={onToggleWant}
            aria-pressed={iWant}
            aria-label={
              iWant
                ? `Убрать отметку «хочу» с «${movie.title}»`
                : `Отметить, что хочу посмотреть «${movie.title}»`
            }
            title={iWant ? "Уже не хочу" : "Хочу посмотреть"}
            className={`absolute bottom-2 left-2 flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none shadow-lg shadow-black/40 transition active:scale-90 ${
              iWant
                ? "bg-rose-500 text-white hover:bg-rose-400"
                : "bg-zinc-900/80 text-zinc-200 ring-1 ring-white/15 hover:bg-zinc-800"
            }`}
          >
            {iWant ? "♥" : "♡"}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleStatus}
          aria-label={
            isWatched
              ? `Вернуть «${movie.title}» в «Хотим»`
              : `Отметить «${movie.title}» как просмотренное`
          }
          title={isWatched ? "Вернуть в «Хотим»" : "Посмотрели"}
          className={`absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold shadow-lg shadow-black/40 transition active:scale-90 ${
            isWatched
              ? "bg-zinc-900/80 text-zinc-200 ring-1 ring-white/15 hover:bg-zinc-800"
              : "bg-amber-400 text-zinc-950 hover:bg-amber-300"
          }`}
        >
          {isWatched ? "↺" : "✓"}
        </button>
      </div>

      <div className="min-w-0 px-0.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
          <Link href={href} className="transition hover:text-amber-400">
            {movie.title}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          {showWants ? (
            <WantedBy wanters={wanters} bothWant={bothWant} />
          ) : (
            <>
              <MemberAvatar name={addedByName} index={addedByIndex} size="xs" />
              <span className="sr-only">добавил(а) {addedByName},</span>
            </>
          )}
          <span className="truncate">
            {movie.year ?? "год неизвестен"}
            {isWatched && movie.watched_at ? (
              <> · смотрели {watchedDate.format(new Date(movie.watched_at))}</>
            ) : (
              movie.runtime && (
                <>
                  {" "}
                  · {movie.media_type === "tv" && "серия "}
                  {formatRuntime(movie.runtime)}
                </>
              )
            )}
          </span>
        </p>
        {services && movie.providers && movie.providers.length > 0 && (
          <CardProviders
            providers={movie.providers}
            region={movie.providers_region}
            services={services}
          />
        )}
        {notes.length > 0 && <CardNotes notes={notes} />}
        {raters && onRate && (
          <CardRating
            title={movie.title}
            members={raters}
            ratings={movie.ratings}
            meId={meId}
            onRate={onRate}
          />
        )}
      </div>
    </article>
  );
}

// Logos to show on a card before "+N".
const CARD_PROVIDERS = 4;

// Small logos of where the title streams; the couple's services come first, ringed.
function CardProviders({
  providers,
  region,
  services,
}: {
  providers: NonNullable<Movie["providers"]>;
  region: string | null;
  services: number[];
}) {
  const ours = (id: number) => services.includes(id);
  const sorted = [...providers].sort((a, b) => Number(ours(b.id)) - Number(ours(a.id)));
  const shown = sorted.slice(0, CARD_PROVIDERS);
  const more = sorted.length - shown.length;
  const where = region && region !== "KG" ? ` (данные для ${region})` : "";
  const label = `Где смотреть${where}: ${sorted.map((p) => p.name).join(", ")}`;
  return (
    <p className="mt-1.5 flex items-center gap-1" title={label}>
      <span className="sr-only">{label}</span>
      {shown.map((p) => (
        <ProviderLogo
          key={p.id}
          provider={p}
          className={ours(p.id) ? "ring-2 ring-amber-400" : "opacity-80"}
        />
      ))}
      {more > 0 && (
        <span aria-hidden className="text-[10px] text-zinc-500">
          +{more}
        </span>
      )}
      {region && region !== "KG" && (
        <span aria-hidden className="text-[10px] uppercase text-zinc-600">
          {region}
        </span>
      )}
    </p>
  );
}

// The first note in one line under the title; the page shows them in full.
function CardNotes({ notes }: { notes: NonNullable<MovieCardProps["notes"]> }) {
  const [first] = notes;
  const all = notes.map((n) => `${n.display_name}: ${n.text}`).join("\n");
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400" title={all}>
      <span aria-hidden className="flex-none">
        💬
      </span>
      <span className="sr-only">Заметки. {all}</span>
      <span aria-hidden className="truncate italic">
        {first.text}
      </span>
      {notes.length > 1 && (
        <span aria-hidden className="flex-none text-[10px] text-zinc-500">
          +{notes.length - 1}
        </span>
      )}
    </p>
  );
}

// Overlapping avatars of who wants the title, and "оба" when that's everyone.
function WantedBy({
  wanters,
  bothWant,
}: {
  wanters: (Member & { index: number })[];
  bothWant: boolean;
}) {
  if (wanters.length === 0) {
    return <span className="flex-none text-zinc-600">никто ·</span>;
  }
  const names = wanters.map((m) => m.display_name).join(" и ");
  return (
    <>
      <span className="flex flex-none -space-x-1" title={`Хочет: ${names}`}>
        {wanters.map((m) => (
          <MemberAvatar
            key={m.id}
            name={m.display_name}
            index={m.index}
            size="xs"
            className="ring-2 ring-stone-950"
          />
        ))}
      </span>
      <span className="sr-only">хочет: {names},</span>
      {bothWant && (
        <span aria-hidden className="flex-none font-medium text-rose-400">
          оба ·
        </span>
      )}
    </>
  );
}

type CardMenuProps = {
  title: string;
  href: string;
  isWatched: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
};

function CardMenu({ title, href, isWatched, onToggleStatus, onDelete }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-zinc-800";

  return (
    // Spans the card's width, so the open menu never sticks out past a narrow card.
    <div ref={rootRef} className="pointer-events-none absolute inset-x-2 top-2 flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Действия: ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-lg leading-none text-zinc-100 backdrop-blur transition hover:bg-black/75"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="animate-pop-in pointer-events-auto absolute inset-x-0 top-10 z-20 origin-top-right rounded-xl border border-zinc-700/60 bg-zinc-900/95 p-1 shadow-2xl shadow-black/60 backdrop-blur"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onToggleStatus();
            }}
            className={`${itemClass} text-zinc-100`}
          >
            {isWatched ? "Вернуть в «Хотим»" : "Посмотрели"}
          </button>
          <Link
            href={href}
            role="menuitem"
            className={`${itemClass} text-zinc-100`}
          >
            Подробнее
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className={`${itemClass} text-red-400 hover:bg-red-950/40`}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
