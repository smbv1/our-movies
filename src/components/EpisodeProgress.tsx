"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setProgress } from "@/app/movies/actions";
import { formatSpot, type EpisodeSpot } from "@/lib/types";

// A season of the main run: its number and how many episodes are out.
export type SeasonInfo = { number: number; episodes: number };

type EpisodeProgressProps = {
  movieId: string;
  // Empty when TMDB didn't answer; then episodes just count up.
  seasons: SeasonInfo[];
  spot: EpisodeSpot | null;
};

// Fallback for the pickers when TMDB doesn't say how many episodes a season has.
const UNKNOWN_EPISODES = 30;

// The episode after `spot`, rolling into the next season; null once the last one is watched.
function nextSpot(spot: EpisodeSpot | null, seasons: SeasonInfo[]): EpisodeSpot | null {
  if (!spot) return { season: seasons[0]?.number ?? 1, episode: 1 };
  const index = seasons.findIndex((s) => s.number === spot.season);
  const current = seasons[index];
  if (!current || spot.episode < current.episodes) {
    return { season: spot.season, episode: spot.episode + 1 };
  }
  const following = seasons[index + 1];
  return following ? { season: following.number, episode: 1 } : null;
}

// The episode before `spot`, back into the previous season; null means not started.
function prevSpot(spot: EpisodeSpot, seasons: SeasonInfo[]): EpisodeSpot | null {
  if (spot.episode > 1) return { season: spot.season, episode: spot.episode - 1 };
  const index = seasons.findIndex((s) => s.number === spot.season);
  const previous = index > 0 ? seasons[index - 1] : null;
  return previous ? { season: previous.number, episode: previous.episodes } : null;
}

// «Где остановились» on a series' page: the last episode watched, a button for the next
// one, and pickers to jump to any episode.
export default function EpisodeProgress({ movieId, seasons, spot }: EpisodeProgressProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(spot);
  const next = nextSpot(shown, seasons);

  function save(target: EpisodeSpot | null) {
    setError(null);
    startTransition(async () => {
      setShown(target);
      const result = await setProgress(movieId, target);
      if (result.error) setError(result.error);
    });
  }

  // Pickers list the known seasons, plus the saved one if TMDB no longer has it.
  const seasonNumbers = seasons.map((s) => s.number);
  if (shown && !seasonNumbers.includes(shown.season)) {
    seasonNumbers.push(shown.season);
    seasonNumbers.sort((a, b) => a - b);
  }
  if (seasonNumbers.length === 0) seasonNumbers.push(1);
  const episodesIn = (season: number) =>
    seasons.find((s) => s.number === season)?.episodes ?? UNKNOWN_EPISODES;
  const pickedSeason = shown?.season ?? seasonNumbers[0];
  const episodeCount = Math.max(episodesIn(pickedSeason), shown?.episode ?? 0);

  const selectClass =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 disabled:opacity-50";

  return (
    <section className="flex max-w-sm flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">Где остановились</h2>
        {shown && (
          <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
            {formatSpot(shown)}
          </span>
        )}
      </div>

      <p className="text-sm text-zinc-300">
        {shown
          ? `Посмотрели ${shown.episode} серию ${shown.season} сезона.`
          : "Ещё не начали смотреть."}
        {shown && !next && (
          <span className="text-emerald-400"> Все вышедшие серии позади!</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {next && (
          <button
            type="button"
            onClick={() => save(next)}
            disabled={isPending}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-sky-950 transition hover:bg-sky-400 disabled:opacity-50"
          >
            {shown ? "Посмотрели ещё одну" : "Посмотрели первую серию"}
            <span className="ml-1.5 text-xs font-normal opacity-75">
              {formatSpot(next)}
            </span>
          </button>
        )}
        {shown && (
          <button
            type="button"
            onClick={() => save(prevSpot(shown, seasons))}
            disabled={isPending}
            title="Отменить последнюю отметку"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            −1 серия
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>Или выбери:</span>
        <label className="flex items-center gap-1">
          <span className="sr-only">Сезон</span>
          <select
            value={pickedSeason}
            disabled={isPending}
            onChange={(e) => {
              const season = Number(e.target.value);
              // Keep the episode when the new season has it, else its last one.
              const episode = Math.min(shown?.episode ?? 1, episodesIn(season));
              save({ season, episode });
            }}
            className={selectClass}
          >
            {seasonNumbers.map((n) => (
              <option key={n} value={n}>
                {n} сезон
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="sr-only">Серия</span>
          <select
            value={shown?.episode ?? ""}
            disabled={isPending}
            onChange={(e) =>
              save({ season: pickedSeason, episode: Number(e.target.value) })
            }
            className={selectClass}
          >
            {!shown && <option value="">серия</option>}
            {Array.from({ length: episodeCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} серия
              </option>
            ))}
          </select>
        </label>
        {shown && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={isPending}
            className="text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-50"
          >
            Сбросить
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
