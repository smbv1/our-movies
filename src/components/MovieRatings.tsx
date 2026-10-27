"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setRating } from "@/app/movies/actions";
import {
  MemberScores,
  RatingPicker,
  VerdictBadge,
  type RatedMember,
} from "@/components/Ratings";

type MovieRatingsProps = {
  movieId: string;
  members: RatedMember[];
  meId: string;
  ratings: Record<string, number>;
};

// «Наши оценки» on a watched title's page: both scores, whether they agree, and my picker.
export default function MovieRatings({
  movieId,
  members,
  meId,
  ratings,
}: MovieRatingsProps) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(ratings);
  const mine = shown[meId] ?? null;

  function rate(score: number | null) {
    const next = { ...shown };
    if (score === null) delete next[meId];
    else next[meId] = score;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await setRating(movieId, score);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="flex max-w-xs flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">Наши оценки</h2>
        <VerdictBadge ratings={shown} />
      </div>
      <div className="text-sm">
        <MemberScores members={members} ratings={shown} size="sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-zinc-500">
          {mine === null
            ? "Моя оценка, от 1 до 10"
            : "Моя оценка. Нажми ещё раз, чтобы убрать"}
        </p>
        <RatingPicker value={mine} onChange={rate} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
