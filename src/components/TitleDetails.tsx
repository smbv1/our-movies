import Link from "next/link";
import type { ReactNode } from "react";
import {
  mainSeasons,
  pickTrailer,
  pickWatchRegion,
  REGION_NAMES,
  type TmdbCredits,
  type TmdbMovieDetails,
  type TmdbProvider,
  type TmdbSeason,
  type TmdbTvDetails,
} from "@/lib/tmdb";
import {
  formatRuntime,
  plural,
  type EpisodeSpot,
  posterSrcSet,
  tmdbImage,
  type MovieStatus,
  type SearchResult,
} from "@/lib/types";

const TV_STATUS_NAMES: Record<string, string> = {
  "Returning Series": "продолжается",
  "In Production": "в производстве",
  Planned: "анонсирован",
  Pilot: "пилот",
  Ended: "завершён",
  Canceled: "закрыт",
};

function yearOf(date: string | null): string | null {
  return date ? date.slice(0, 4) : null;
}

type TitleDetailsProps = {
  // What we know without TMDB: the saved list row, or the TMDB details themselves.
  base: SearchResult;
  info: TmdbMovieDetails | TmdbTvDetails | null;
  detailsError: string | null;
  backHref: string;
  // Provider ids of the couple's streaming services, marked in «Где посмотреть».
  services?: number[];
  // Tab the page belongs to; a person's page opened from here adds titles there.
  tab?: MovieStatus;
  // Where the couple stopped in a series, marked on the seasons.
  progress?: EpisodeSpot | null;
  // Status line and buttons shown under the overview.
  children: ReactNode;
};

// The detail page body, shared by titles in the list and titles opened from search.
export default function TitleDetails({
  base,
  info,
  detailsError,
  backHref,
  services = [],
  tab = "want",
  progress = null,
  children,
}: TitleDetailsProps) {
  const isTv = base.media_type === "tv";
  const tv = info && "number_of_seasons" in info ? info : null;
  const film = info && "runtime" in info ? info : null;
  const trailer = pickTrailer(info?.videos?.results);
  const watch = pickWatchRegion(info?.["watch/providers"]?.results);
  const posterPath = info?.poster_path ?? base.poster_path;
  const overview = info?.overview || base.overview;
  const noun = isTv ? "сериал" : "фильм";

  // "2019–2023" for a finished series, "2019–…" for one still running.
  let years = base.year ? String(base.year) : null;
  if (tv) {
    const first = yearOf(tv.first_air_date) ?? years;
    const last = yearOf(tv.last_air_date);
    const finished = tv.status === "Ended" || tv.status === "Canceled";
    years = !first
      ? null
      : finished
        ? last && last !== first ? `${first}–${last}` : first
        : `${first}–…`;
  }
  const episodeMinutes = tv?.episode_run_time[0];

  const facts = [
    isTv ? "Сериал" : null,
    years,
    film?.runtime ? formatRuntime(film.runtime) : null,
    tv && tv.number_of_seasons > 0
      ? plural(tv.number_of_seasons, ["сезон", "сезона", "сезонов"])
      : null,
    tv && tv.number_of_episodes > 0
      ? plural(tv.number_of_episodes, ["серия", "серии", "серий"])
      : null,
    episodeMinutes ? `~${formatRuntime(episodeMinutes)} серия` : null,
    tv && TV_STATUS_NAMES[tv.status] ? TV_STATUS_NAMES[tv.status] : null,
    info?.genres.length ? info.genres.map((g) => g.name).join(", ") : null,
    info && info.vote_count > 0 ? `★ ${info.vote_average.toFixed(1)}` : null,
  ].filter(Boolean);

  const people = creditPeople(info);

  const seasons = tv ? mainSeasons(tv) : [];

  return (
    <div className="relative flex min-h-screen w-full flex-col">
      {info?.backdrop_path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tmdbImage(info.backdrop_path, "w780")}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 w-full object-cover opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
      )}

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
        <Link
          href={backHref}
          className="w-fit text-sm text-zinc-400 transition hover:text-zinc-100"
        >
          ← К списку
        </Link>

        <section className="flex flex-col gap-6 sm:flex-row">
          {posterPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tmdbImage(posterPath, "w342")}
              srcSet={posterSrcSet(posterPath)}
              sizes="(min-width: 640px) 224px, 160px"
              fetchPriority="high"
              alt={base.title}
              className="aspect-[2/3] w-40 shrink-0 self-center rounded-xl object-cover shadow-lg sm:w-56 sm:self-start"
            />
          ) : (
            <div className="flex aspect-[2/3] w-40 shrink-0 items-center justify-center self-center rounded-xl bg-zinc-800 text-sm text-zinc-500 sm:w-56 sm:self-start">
              нет постера
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-3xl">
                {base.title}
              </h1>
              {base.original_title && base.original_title !== base.title && (
                <p className="mt-1 text-sm text-zinc-500">
                  {base.original_title}
                </p>
              )}
            </div>

            {facts.length > 0 && (
              <p className="text-sm text-zinc-300">{facts.join(" · ")}</p>
            )}

            {info?.tagline && (
              <p className="text-sm italic text-zinc-400">«{info.tagline}»</p>
            )}

            {overview ? (
              <p className="text-sm leading-relaxed text-zinc-300">
                {overview}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">Описания пока нет.</p>
            )}

            {children}

            {detailsError && (
              <p role="alert" className="text-xs text-red-400">
                Не удалось загрузить подробности из TMDB: {detailsError}
              </p>
            )}
          </div>
        </section>

        {people.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">
              Создатели и актёры
            </h2>
            <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {people.map((p) => (
                <li key={`${p.id}-${p.role}`} className="flex-none">
                  <Link
                    href={`/person/${p.id}?tab=${tab}`}
                    className="flex w-24 flex-col items-center gap-1.5 rounded-lg p-1 text-center transition hover:bg-zinc-900"
                  >
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tmdbImage(p.photo, "w185")}
                        alt=""
                        loading="lazy"
                        className="h-16 w-16 rounded-full object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-xl text-zinc-500">
                        👤
                      </span>
                    )}
                    <span className="line-clamp-2 text-xs font-medium text-zinc-200">
                      {p.name}
                    </span>
                    {p.role && (
                      <span className="line-clamp-1 text-[11px] text-zinc-500">
                        {p.role}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {trailer && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Трейлер</h2>
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer.key}`}
                title={trailer.name}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </section>
        )}

        {seasons.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Сезоны</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {seasons.map((season) => (
                <SeasonRow key={season.id} season={season} progress={progress} />
              ))}
            </ul>
          </section>
        )}

        {info && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">
              Где посмотреть онлайн
            </h2>
            {watch ? (
              <>
                {watch.region !== "KG" && (
                  <p className="text-xs text-zinc-500">
                    Для Кыргызстана данных нет, показываем для региона «
                    {REGION_NAMES[watch.region]}». Сервисы могут быть доступны
                    не везде.
                  </p>
                )}
                <ProviderRow
                  label="По подписке"
                  services={services}
                  providers={watch.providers.flatrate}
                />
                <ProviderRow
                  label="Бесплатно"
                  services={services}
                  providers={[
                    ...(watch.providers.free ?? []),
                    ...(watch.providers.ads ?? []),
                  ]}
                />
                <ProviderRow
                  label="Аренда"
                  providers={watch.providers.rent}
                  services={services}
                />
                <ProviderRow
                  label="Покупка"
                  providers={watch.providers.buy}
                  services={services}
                />
                <a
                  href={watch.providers.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-fit text-xs text-amber-400 hover:text-amber-300"
                >
                  Все варианты на TMDB ↗
                </a>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                TMDB пока не знает, где этот {noun} доступен онлайн.
              </p>
            )}
            <p className="text-xs text-zinc-600">Данные о сервисах: JustWatch</p>
          </section>
        )}
      </div>
    </div>
  );
}

function SeasonRow({
  season,
  progress,
}: {
  season: TmdbSeason;
  progress: EpisodeSpot | null;
}) {
  const year = yearOf(season.air_date);
  const n = season.season_number;
  const done =
    progress !== null &&
    (n < progress.season ||
      (n === progress.season && progress.episode >= season.episode_count));
  const current = progress !== null && !done && n === progress.season;
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
        current ? "border-sky-500/60 bg-sky-500/10" : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <span
        className={`min-w-0 truncate text-sm ${done ? "text-zinc-500" : "text-zinc-200"}`}
      >
        {done && <span className="text-emerald-400">✓ </span>}
        {season.name}
      </span>
      <span className="flex-none text-xs text-zinc-500">
        {current ? (
          <span className="text-sky-300">
            {progress.episode} из {season.episode_count}
          </span>
        ) : (
          [year, plural(season.episode_count, ["серия", "серии", "серий"])]
            .filter(Boolean)
            .join(" · ")
        )}
      </span>
    </li>
  );
}

function ProviderRow({
  label,
  providers,
  services,
}: {
  label: string;
  providers: TmdbProvider[] | undefined;
  services: number[];
}) {
  // The same service can appear under both "free" and "ads".
  const unique = [
    ...new Map((providers ?? []).map((p) => [p.provider_id, p])).values(),
  ].sort((a, b) => a.display_priority - b.display_priority);
  if (unique.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {unique.map((p) => {
          const ours = services.includes(p.provider_id);
          return (
            <li
              key={p.provider_id}
              className={`flex items-center gap-2 rounded-lg border py-1 pl-1 pr-3 ${
                ours
                  ? "border-amber-400/60 bg-amber-400/10"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              {p.logo_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tmdbImage(p.logo_path, "w92")}
                  loading="lazy"
                  alt=""
                  className="h-8 w-8 rounded-md"
                />
              ) : (
                <span className="h-8 w-8 rounded-md bg-zinc-800" />
              )}
              <span className="text-sm text-zinc-200">{p.provider_name}</span>
              {ours && (
                <span className="text-xs text-amber-400">у нас есть</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const MAX_CAST = 12;

type CreditPerson = { id: number; name: string; photo: string | null; role: string | null };

// Directors (or a series' creators) first, then the top-billed cast, each linking to
// their filmography.
function creditPeople(info: TmdbMovieDetails | TmdbTvDetails | null): CreditPerson[] {
  if (!info) return [];
  const credits: TmdbCredits | undefined = info.credits;
  const makers: CreditPerson[] =
    "created_by" in info && info.created_by?.length
      ? info.created_by.map((p) => ({
          id: p.id,
          name: p.name,
          photo: p.profile_path,
          role: "создатель",
        }))
      : (credits?.crew ?? [])
          .filter((c) => c.job === "Director")
          .map((c) => ({ id: c.id, name: c.name, photo: c.profile_path, role: "режиссёр" }));
  const cast = [...(credits?.cast ?? [])]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CAST)
    .map((c) => ({ id: c.id, name: c.name, photo: c.profile_path, role: c.character || null }));
  // A director who also acts keeps one chip.
  const seen = new Set<number>();
  return [...makers, ...cast].filter((p) => !seen.has(p.id) && (seen.add(p.id), true));
}
