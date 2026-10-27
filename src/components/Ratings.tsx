"use client";

import { useEffect, useRef, useState } from "react";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import { MAX_RATING, ratingVerdict, type RatingVerdict } from "@/lib/types";

export type RatedMember = Member & { index: number };

const SCORES = Array.from({ length: MAX_RATING }, (_, i) => i + 1);

const VERDICTS: Record<RatingVerdict, { label: string; className: string }> = {
  match: { label: "совпали", className: "bg-emerald-400/15 text-emerald-300" },
  close: { label: "почти", className: "bg-zinc-800 text-zinc-300" },
  apart: { label: "разошлись", className: "bg-orange-400/15 text-orange-300" },
};

// Low scores read red, middling amber, high green.
function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-300";
  if (score >= 5) return "text-amber-300";
  return "text-rose-300";
}

// Ten buttons, 1 to 10; tapping the current score again clears it.
export function RatingPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (score: number | null) => void;
}) {
  return (
    <div role="group" aria-label="Моя оценка" className="grid grid-cols-5 gap-1.5">
      {SCORES.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : n)}
            title={active ? "Убрать оценку" : `Поставить ${n}`}
            className={`flex h-9 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition active:scale-95 ${
              active
                ? "bg-amber-400 text-zinc-950"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function VerdictBadge({ ratings }: { ratings: Record<string, number> }) {
  const verdict = ratingVerdict(Object.values(ratings));
  if (!verdict) return null;
  const { label, className } = VERDICTS[verdict];
  return (
    <span
      className={`flex-none rounded-full px-1.5 py-px text-[10px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

// Each member's avatar with their score, or a dash where they haven't rated yet.
export function MemberScores({
  members,
  ratings,
  size = "xs",
}: {
  members: RatedMember[];
  ratings: Record<string, number>;
  size?: "xs" | "sm";
}) {
  return (
    <span className="flex flex-none items-center gap-2">
      {members.map((m) => {
        const score = ratings[m.id];
        return (
          <span
            key={m.id}
            className="flex items-center gap-1"
            title={
              score ? `${m.display_name}: ${score} из ${MAX_RATING}` : `${m.display_name} ещё не оценил(а)`
            }
          >
            <MemberAvatar name={m.display_name} index={m.index} size={size} />
            <span
              className={`font-semibold tabular-nums ${
                score ? scoreColor(score) : "text-zinc-600"
              } ${size === "sm" ? "text-base" : ""}`}
            >
              {score ?? "–"}
            </span>
            <span className="sr-only">
              {score
                ? `${m.display_name}: ${score} из ${MAX_RATING}`
                : `${m.display_name}: нет оценки`}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// The rating line under a watched card: scores, verdict, and a button that opens the picker.
export function CardRating({
  title,
  members,
  ratings,
  meId,
  onRate,
}: {
  title: string;
  members: RatedMember[];
  ratings: Record<string, number>;
  meId: string;
  onRate: (score: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mine = ratings[meId] ?? null;

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

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          mine ? `Изменить мою оценку «${title}»` : `Оценить «${title}»`
        }
        className="flex w-full flex-wrap items-center gap-1.5 rounded-lg py-0.5 text-left text-xs transition hover:bg-zinc-900"
      >
        {mine === null ? (
          <span className="flex-none rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-300">
            ★ Оценить
          </span>
        ) : null}
        {(mine !== null || members.length > 1) && (
          <MemberScores members={members} ratings={ratings} />
        )}
        <VerdictBadge ratings={ratings} />
      </button>
      {open && (
        <div className="animate-pop-in absolute inset-x-0 top-full z-20 mt-1 origin-top rounded-xl border border-zinc-700/60 bg-zinc-900/95 p-2 shadow-2xl shadow-black/60 backdrop-blur">
          <p className="mb-2 px-0.5 text-xs text-zinc-400">
            Моя оценка
          </p>
          <RatingPicker
            value={mine}
            onChange={(score) => {
              setOpen(false);
              onRate(score);
            }}
          />
        </div>
      )}
    </div>
  );
}
