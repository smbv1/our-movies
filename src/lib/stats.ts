import {
  averageRating,
  ratingVerdict,
  type Movie,
  type RatingVerdict,
  type StoredProvider,
} from "@/lib/types";

export type MonthCount = { key: string; label: string; count: number };
export type GenreCount = { genre: string; count: number; avg: number | null };
export type MemberStats = {
  id: string;
  added: number;
  wants: number;
  rated: number;
  avg: number | null;
};
export type ProviderCount = { provider: StoredProvider; count: number };

export type CoupleStats = {
  watchedFilms: number;
  watchedSeries: number;
  // Minutes in front of the screen: film lengths plus episodes × episode length.
  watchedMinutes: number;
  // Watched titles whose length TMDB doesn't know, left out of watchedMinutes.
  unknownLength: number;
  watchedThisYear: number;
  wantCount: number;
  wantMinutes: number;
  months: MonthCount[];
  genres: GenreCount[];
  members: MemberStats[];
  // Titles everyone has rated, by how close the scores are.
  verdicts: Record<RatingVerdict, number>;
  bestTogether: Movie[];
  biggestSplits: Movie[];
  // Services that titles still to watch are on, most titles first.
  wantProviders: ProviderCount[];
  wantOnOurServices: number;
};

// How many months of history the chart shows, this one included.
const MONTHS = 12;
const TOP_GENRES = 8;
const TOP_TITLES = 3;

const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "short" });

// Screen time for one title: a whole series counts all its episodes.
export function titleMinutes(m: Movie): number | null {
  if (!m.runtime) return null;
  if (m.media_type === "tv") return m.episodes ? m.runtime * m.episodes : null;
  return m.runtime;
}

export function coupleStats(
  movies: Movie[],
  memberIds: string[],
  services: number[],
  now: Date,
): CoupleStats {
  const watched = movies.filter((m) => m.status === "watched");
  const want = movies.filter((m) => m.status === "want");

  let watchedMinutes = 0;
  let unknownLength = 0;
  for (const m of watched) {
    const minutes = titleMinutes(m);
    if (minutes === null) unknownLength += 1;
    else watchedMinutes += minutes;
  }
  const wantMinutes = want.reduce((sum, m) => sum + (titleMinutes(m) ?? 0), 0);

  // Month buckets keyed "2026-10", oldest first, in the server's calendar (UTC).
  const months: MonthCount[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    months.push({
      key: d.toISOString().slice(0, 7),
      label: monthLabel.format(d).replace(".", ""),
      count: 0,
    });
  }
  const monthByKey = new Map(months.map((m) => [m.key, m]));
  const year = String(now.getUTCFullYear());
  let watchedThisYear = 0;
  for (const m of watched) {
    if (!m.watched_at) continue;
    const month = monthByKey.get(m.watched_at.slice(0, 7));
    if (month) month.count += 1;
    if (m.watched_at.startsWith(year)) watchedThisYear += 1;
  }

  const genreMap = new Map<string, { count: number; scores: number[] }>();
  for (const m of watched) {
    const avg = averageRating(m.ratings);
    for (const g of m.genres ?? []) {
      const entry = genreMap.get(g) ?? { count: 0, scores: [] };
      entry.count += 1;
      if (avg !== null) entry.scores.push(avg);
      genreMap.set(g, entry);
    }
  }
  const genres = [...genreMap.entries()]
    .map(([genre, e]) => ({
      genre,
      count: e.count,
      avg: e.scores.length
        ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length
        : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0))
    .slice(0, TOP_GENRES);

  const members = memberIds.map((id) => {
    const scores = watched.flatMap((m) =>
      m.ratings[id] === undefined ? [] : [m.ratings[id]],
    );
    return {
      id,
      added: movies.filter((m) => m.added_by === id).length,
      wants: want.filter((m) => m.wanted_by.includes(id)).length,
      rated: scores.length,
      avg: scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null,
    };
  });

  // Only titles every member has scored say anything about agreement.
  const verdicts: Record<RatingVerdict, number> = {
    match: 0,
    close: 0,
    apart: 0,
  };
  const ratedByAll: { movie: Movie; avg: number; spread: number }[] = [];
  if (memberIds.length > 1) {
    for (const m of watched) {
      const scores = memberIds.map((id) => m.ratings[id]);
      if (scores.some((s) => s === undefined)) continue;
      const verdict = ratingVerdict(scores);
      if (verdict) verdicts[verdict] += 1;
      ratedByAll.push({
        movie: m,
        avg: averageRating(m.ratings) ?? 0,
        spread: Math.max(...scores) - Math.min(...scores),
      });
    }
  }
  const bestTogether = [...ratedByAll]
    .sort((a, b) => b.avg - a.avg || a.spread - b.spread)
    .slice(0, TOP_TITLES)
    .map((e) => e.movie);
  const biggestSplits = ratedByAll
    .filter((e) => e.spread >= 3)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, TOP_TITLES)
    .map((e) => e.movie);

  const providerMap = new Map<number, ProviderCount>();
  let wantOnOurServices = 0;
  for (const m of want) {
    const providers = m.providers ?? [];
    if (providers.some((p) => services.includes(p.id))) wantOnOurServices += 1;
    for (const p of providers) {
      const entry = providerMap.get(p.id);
      if (entry) entry.count += 1;
      else providerMap.set(p.id, { provider: p, count: 1 });
    }
  }
  const wantProviders = [...providerMap.values()].sort(
    (a, b) => b.count - a.count,
  );

  return {
    watchedFilms: watched.filter((m) => m.media_type === "movie").length,
    watchedSeries: watched.filter((m) => m.media_type === "tv").length,
    watchedMinutes,
    unknownLength,
    watchedThisYear,
    wantCount: want.length,
    wantMinutes,
    months,
    genres,
    members,
    verdicts,
    bestTogether,
    biggestSplits,
    wantProviders,
    wantOnOurServices,
  };
}
