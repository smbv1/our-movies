import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import SuggestionGrid from "@/components/SuggestionGrid";
import {
  becauseNote,
  LIKED_SCORE,
  pickSeeds,
  rankRecommendations,
} from "@/lib/recommendations";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getRecommendations } from "@/lib/tmdb";
import { searchKey, type Movie, type MovieStatus } from "@/lib/types";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

export const metadata = { title: "Что посмотреть · Наши фильмы" };

const HEADINGS = {
  both: "Похоже на то, что понравилось вам обоим",
  liked: "Похоже на то, что вам понравилось",
  recent: "Похоже на то, что вы недавно смотрели",
} as const;

export default async function DiscoverPage() {
  const supabase = await createClient();
  const [userId, listRes, membersRes, moviesRes] = await Promise.all([
    getUserId(supabase),
    supabase.from("lists").select("id").maybeSingle(),
    supabase
      .from("profiles")
      .select("id")
      .order("created_at", { ascending: true }),
    supabase.from("movies").select("*"),
  ]);
  if (!userId) redirect("/login");
  if (!listRes.data) redirect("/onboarding");

  // Rows read before migration 0007 has run have no ratings.
  const movies: Movie[] = (moviesRes.data ?? []).map((m) => ({
    ...m,
    ratings: m.ratings ?? {},
  }));
  const memberIds = (membersRes.data ?? []).map((m) => m.id);
  const pair = memberIds.length > 1;
  const { kind, seeds } = pickSeeds(movies, memberIds);

  const responses = await Promise.all(
    seeds.map((s) => getRecommendations(s.movie.media_type, s.movie.tmdb_id)),
  );
  const failed = responses.find((r) => r.error !== null);
  const existing: Record<string, MovieStatus> = Object.fromEntries(
    movies.map((m) => [searchKey(m), m.status]),
  );
  const recommendations = rankRecommendations(
    seeds,
    responses.map((r) => r.data?.results ?? null),
    new Set(Object.keys(existing)),
  );

  const heading =
    kind === "both" && !pair ? HEADINGS.liked : HEADINGS[kind];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-24 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      <Link
        href="/"
        className="w-fit text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        ← К списку
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Что посмотреть
        </h1>
        {seeds.length > 0 && (
          <p className="text-sm text-zinc-400">
            {heading}:{" "}
            {seeds
              .slice(0, 3)
              .map((s) => `«${s.movie.title}»`)
              .join(", ")}
            {seeds.length > 3 && ` и ещё ${seeds.length - 3}`}
          </p>
        )}
      </div>

      {kind === "recent" && seeds.length > 0 && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200/90">
          Оцените посмотренное от 1 до 10, и подборка станет точнее: в неё
          попадёт то, что {pair ? "вам обоим" : "вам"} понравилось на{" "}
          {LIKED_SCORE}+.
        </p>
      )}

      {seeds.length === 0 ? (
        <EmptyState
          icon="✨"
          title={
            kind === "recent" && movies.some((m) => m.status === "watched")
              ? `Пока нет ничего на ${LIKED_SCORE}+`
              : "Сначала посмотрите что-нибудь"
          }
          hint={`Подборка строится по фильмам и сериалам из «Посмотрели», которые ${
            pair ? "вы оба" : "вы"
          } оценили на ${LIKED_SCORE} и выше.`}
          action={
            <Link
              href="/?tab=watched"
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
            >
              К «Посмотрели»
            </Link>
          }
        />
      ) : recommendations.length === 0 ? (
        failed ? (
          <p role="alert" className="text-sm text-red-400">
            Не удалось получить рекомендации из TMDB: {failed.error}
          </p>
        ) : (
          <EmptyState
            icon="🎬"
            title="Новых идей пока нет"
            hint="Всё, что TMDB советует по вашим любимым, уже есть в списке. Оцените ещё что-нибудь."
          />
        )
      ) : (
        <SuggestionGrid
          items={recommendations.map((r) => ({
            movie: r.movie,
            note: becauseNote(r.because),
          }))}
          existing={existing}
          addAs="want"
          typeFilter
        />
      )}
    </div>
  );
}
