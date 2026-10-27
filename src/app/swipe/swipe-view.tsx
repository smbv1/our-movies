"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { createClient } from "@/lib/supabase/client";
import type { SwipeCard, SwipeDeck } from "@/lib/swipe";
import {
  capitalize,
  posterSrcSet,
  searchKey,
  tmdbImage,
  type MediaType,
} from "@/lib/types";
import { loadMoreCards, swipeTitle, undoSwipe } from "./actions";

type SwipeViewProps = {
  kind: MediaType;
  initialDeck: SwipeDeck & { error: string | null };
  listId: string;
  meId: string;
  members: Member[];
};

type Match = {
  id: string;
  title: string;
  poster_path: string | null;
  // The partner's swipe made it, while this person was swiping too.
  byPartner: boolean;
};

// The last swipe, which can be taken back unless it made a match.
type LastSwipe = { card: SwipeCard; liked: boolean; matched: boolean };

// How far (px) a card must be dragged to count as a swipe.
const SWIPE_THRESHOLD = 100;
// Matches the card's fly-out transition.
const FLY_OUT_MS = 220;
// Fetch more cards when this few are left.
const REFILL_AT = 5;

export default function SwipeView({
  kind,
  initialDeck,
  listId,
  meId,
  members,
}: SwipeViewProps) {
  const toast = useToast();
  const [cards, setCards] = useState(initialDeck.cards);
  const [nextPage, setNextPage] = useState(initialDeck.nextPage);
  const [loadError, setLoadError] = useState(initialDeck.error);
  const [loading, startLoading] = useTransition();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [flying, setFlying] = useState<"left" | "right" | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [last, setLast] = useState<LastSwipe | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Saves run in order, so an undo never overtakes the swipe it takes back.
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  const partner = members.find((m) => m.id !== meId);
  const card = cards[index] as SwipeCard | undefined;
  const noun = kind === "tv" ? "сериалы" : "фильмы";

  // Tops up the deck before it runs out; a page with nothing new moves nextPage on,
  // which runs this again.
  useEffect(() => {
    if (loading || loadError || nextPage === null) return;
    if (cards.length - index > REFILL_AT) return;
    startLoading(async () => {
      const res = await loadMoreCards(kind, nextPage);
      setLoadError(res.error);
      if (res.error) return;
      setCards((prev) => {
        const have = new Set(prev.map(searchKey));
        return [...prev, ...res.cards.filter((c) => !have.has(searchKey(c)))];
      });
      setNextPage(res.nextPage);
    });
  }, [cards.length, index, kind, loadError, loading, nextPage]);

  const decide = useCallback(
    (liked: boolean) => {
      if (!card || flying) return;
      setFlying(liked ? "right" : "left");
      setShowInfo(false);
      const entry: LastSwipe = { card, liked, matched: false };
      setLast(entry);
      setTimeout(() => {
        setFlying(null);
        setDrag(null);
        setIndex((i) => i + 1);
      }, FLY_OUT_MS);

      const save = saving.current.then(async () => {
        const res = await swipeTitle(card, liked);
        if (res.error) {
          toast.show({ message: res.error, tone: "error" });
          return;
        }
        if (res.match) {
          entry.matched = true;
          setLast((l) => (l === entry ? { ...entry } : l));
          setMatchCount((n) => n + 1);
          setMatch({
            id: res.match.id,
            title: card.title,
            poster_path: card.poster_path,
            byPartner: false,
          });
        }
      });
      saving.current = save;
    },
    [card, flying, toast],
  );

  const undo = useCallback(() => {
    if (!last || last.matched || flying) return;
    const { card: back } = last;
    setLast(null);
    setShowInfo(false);
    setIndex((i) => Math.max(0, i - 1));
    saving.current = saving.current.then(async () => {
      const res = await undoSwipe(back.media_type, back.tmdb_id);
      if (res.error) toast.show({ message: res.error, tone: "error" });
    });
  }, [flying, last, toast]);

  // Arrow keys swipe on a computer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (match || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") decide(true);
      else if (e.key === "ArrowLeft") decide(false);
      else if (e.key === "Backspace" || (e.key === "z" && (e.metaKey || e.ctrlKey))) undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, match, undo]);

  // When the partner's swipe completes a match, it shows up here too.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`swipe-matches-${listId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "movies", filter: `list_id=eq.${listId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            title: string;
            poster_path: string | null;
            added_by: string;
            wanted_by: string[] | null;
          };
          // Only a match adds a title wanted by both; the user's own matches show already.
          if (row.added_by === meId || (row.wanted_by?.length ?? 0) < 2) return;
          setMatchCount((n) => n + 1);
          setMatch({
            id: row.id,
            title: row.title,
            poster_path: row.poster_path,
            byPartner: true,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, meId]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (flying) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }

  function onPointerUp() {
    if (!start.current) return;
    start.current = null;
    const dx = drag?.x ?? 0;
    const moved = Math.hypot(dx, drag?.y ?? 0);
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      decide(dx > 0);
    } else {
      setDrag(null);
      // A tap, not a drag: show or hide the description.
      if (moved < 6) setShowInfo((v) => !v);
    }
  }

  const dx = flying ? (flying === "right" ? 600 : -600) : (drag?.x ?? 0);
  const dy = flying ? (drag?.y ?? 0) : (drag?.y ?? 0) * 0.3;
  const likeness = Math.max(-1, Math.min(1, dx / SWIPE_THRESHOLD));
  const visible = cards.slice(index, index + 3);

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition ${
      active ? "bg-zinc-100 text-zinc-900 shadow" : "text-zinc-400 hover:text-zinc-100"
    }`;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-zinc-400 transition hover:text-zinc-100">
          ← К списку
        </Link>
        {matchCount > 0 && (
          <Link
            href="/?tab=want"
            className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-200 ring-1 ring-rose-400/30"
          >
            ♥ Совпадений: {matchCount}
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Свайпы</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Вправо — хочу, влево — мимо. Что вы оба захотите, само попадёт в «Хотим».
        </p>
      </div>

      <nav
        aria-label="Что листать"
        className="flex gap-1 rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800"
      >
        <Link href="/swipe" replace className={tabClass(kind === "movie")} aria-current={kind === "movie" ? "page" : undefined}>
          Фильмы
        </Link>
        <Link href="/swipe?type=tv" replace className={tabClass(kind === "tv")} aria-current={kind === "tv" ? "page" : undefined}>
          Сериалы
        </Link>
      </nav>

      {!partner && (
        <p className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-zinc-300 ring-1 ring-zinc-800">
          Пока в списке только ты. Лайки сохранятся, а совпадения появятся, когда
          партнёр присоединится по коду пары и тоже полистает.
        </p>
      )}

      {/* As big as fits between the header and the buttons, in poster proportions. */}
      <div className="relative mx-auto aspect-[2/3] h-[min(calc(100dvh-19rem),calc((100vw-2rem)*1.5),39rem)] min-h-72 select-none">
        {visible.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-zinc-900 p-6 text-center ring-1 ring-zinc-800">
            {loading ? (
              <>
                <Spinner />
                <p className="text-sm text-zinc-400">Подбираем {noun}…</p>
              </>
            ) : loadError ? (
              <>
                <p className="text-sm text-zinc-300">{loadError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(null);
                  }}
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
                >
                  Попробовать ещё раз
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-zinc-100">Популярное закончилось</p>
                <p className="text-sm text-zinc-400">
                  Ты пролистал все популярные {noun}. Загляни позже или попробуй{" "}
                  {kind === "tv" ? "фильмы" : "сериалы"}.
                </p>
              </>
            )}
          </div>
        ) : (
          visible
            .map((c, i) => {
              const top = i === 0;
              const style = top
                ? {
                    transform: `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`,
                    transition: drag && !flying ? "none" : `transform ${FLY_OUT_MS}ms ease-out`,
                  }
                : {
                    transform: `translateY(${i * 10}px) scale(${1 - i * 0.04})`,
                    transition: `transform ${FLY_OUT_MS}ms ease-out`,
                  };
              return (
                <div
                  key={searchKey(c)}
                  className={`absolute inset-0 overflow-hidden rounded-3xl bg-zinc-900 shadow-2xl ring-1 ring-zinc-800 ${
                    top ? "cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none"
                  }`}
                  style={{ ...style, zIndex: 10 - i }}
                  aria-hidden={!top}
                  {...(top && {
                    onPointerDown,
                    onPointerMove,
                    onPointerUp,
                    onPointerCancel: onPointerUp,
                  })}
                >
                  {c.poster_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tmdbImage(c.poster_path, "w500")}
                      srcSet={posterSrcSet(c.poster_path)}
                      sizes="(min-width: 448px) 416px, 92vw"
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {top && (
                    <>
                      <span
                        className="absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black uppercase tracking-wider text-emerald-400"
                        style={{ opacity: Math.max(0, likeness) }}
                      >
                        Хочу
                      </span>
                      <span
                        className="absolute right-5 top-6 rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-black uppercase tracking-wider text-rose-400"
                        style={{ opacity: Math.max(0, -likeness) }}
                      >
                        Мимо
                      </span>
                    </>
                  )}
                  <div
                    className={`absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-14 ${
                      top && showInfo ? "max-h-full overflow-y-auto" : ""
                    }`}
                  >
                    <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
                      {c.title}
                      {c.year && (
                        <span className="ml-2 text-lg font-normal text-zinc-300">{c.year}</span>
                      )}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-300">
                      {c.vote_average !== null && (
                        <span className="font-semibold text-amber-300">
                          ★ {c.vote_average.toFixed(1).replace(".", ",")}
                        </span>
                      )}
                      {c.genres.slice(0, 3).map((g) => (
                        <span key={g}>{capitalize(g)}</span>
                      ))}
                    </div>
                    {c.overview && (
                      <p
                        className={`text-sm text-zinc-200 ${
                          top && showInfo ? "" : "line-clamp-2"
                        }`}
                      >
                        {c.overview}
                      </p>
                    )}
                    {top && (
                      <p className="text-xs text-zinc-500">
                        {showInfo ? "Нажми, чтобы свернуть" : "Нажми, чтобы прочитать описание"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
            .reverse()
        )}
      </div>

      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={undo}
          disabled={!last || last.matched || !!flying}
          aria-label="Вернуть прошлую карточку"
          title="Вернуть прошлую карточку"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl text-amber-300 ring-1 ring-zinc-800 transition hover:bg-zinc-800 disabled:opacity-30"
        >
          ↺
        </button>
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={!card}
          aria-label="Мимо"
          title="Мимо (←)"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-3xl text-rose-400 ring-1 ring-zinc-800 transition hover:scale-105 hover:bg-zinc-800 disabled:opacity-30"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={!card}
          aria-label="Хочу"
          title="Хочу (→)"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-3xl text-emerald-400 ring-1 ring-zinc-800 transition hover:scale-105 hover:bg-zinc-800 disabled:opacity-30"
        >
          ♥
        </button>
      </div>

      {match && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setMatch(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="swipe-match-title"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-xs flex-col items-center gap-4 rounded-3xl bg-zinc-900 p-6 text-center ring-1 ring-zinc-800"
          >
            <p
              id="swipe-match-title"
              className="bg-gradient-to-r from-rose-300 to-amber-200 bg-clip-text text-3xl font-black text-transparent"
            >
              Совпадение!
            </p>
            {match.poster_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tmdbImage(match.poster_path, "w342")}
                alt=""
                className="aspect-[2/3] w-40 rounded-xl object-cover shadow-lg"
              />
            )}
            <div className="flex items-center gap-2">
              {members.map((m, i) => (
                <MemberAvatar key={m.id} name={m.display_name} index={i} size="md" />
              ))}
            </div>
            <p className="text-sm text-zinc-300">
              {match.byPartner && partner ? (
                <>
                  {partner.display_name} тоже хочет «{match.title}».
                </>
              ) : (
                <>Вы оба хотите «{match.title}».</>
              )}{" "}
              Уже в «Хотим».
            </p>
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setMatch(null)}
                className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900"
              >
                Листать дальше
              </button>
              <Link
                href={`/movies/${match.id}`}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 ring-1 ring-zinc-700 hover:bg-zinc-800"
              >
                Открыть
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
