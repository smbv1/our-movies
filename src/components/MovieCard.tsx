"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MemberAvatar from "@/components/MemberAvatar";
import { posterSrcSet, tmdbImage, type Movie } from "@/lib/types";

type MovieCardProps = {
  movie: Movie;
  addedByName: string;
  // Position of the adder among the list's members; picks the avatar color.
  addedByIndex: number;
  // Load the poster right away instead of lazily (cards in the first row).
  eager?: boolean;
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
  onToggleStatus,
  onDelete,
}: MovieCardProps) {
  const isWatched = movie.status === "watched";
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
          <MemberAvatar name={addedByName} index={addedByIndex} size="xs" />
          <span className="sr-only">добавил(а) {addedByName},</span>
          <span className="truncate">
            {movie.year ?? "год неизвестен"}
            {isWatched && movie.watched_at && (
              <> · смотрели {watchedDate.format(new Date(movie.watched_at))}</>
            )}
          </span>
        </p>
      </div>
    </article>
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
