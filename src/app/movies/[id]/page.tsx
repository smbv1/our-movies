import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StatusToggle from "@/components/StatusToggle";
import { createClient, getUserId } from "@/lib/supabase/server";
import {
  getMovieDetails,
  getTvDetails,
  pickTrailer,
  pickWatchRegion,
  REGION_NAMES,
  type TmdbProvider,
  type TmdbSeason,
} from "@/lib/tmdb";
import {
  posterSrcSet,
  tmdbImage,
  type Movie,
} from "@/lib/types";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

// Russian noun form for a count: plural(3, ["сезон", "сезона", "сезонов"]) → "3 сезона".
function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;
  return `${n} ${word}`;
}

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

export default async function MoviePage({ params }: PageProps<"/movies/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  // RLS only returns movies from the user's own list; the adder's name comes embedded.
  const [userId, movieRes] = await Promise.all([
    getUserId(supabase),
    supabase
      .from("movies")
      .select("*, added_by_profile:profiles!movies_added_by_fkey(display_name)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!userId) redirect("/login");
  const movie = movieRes.data as
    | (Movie & { added_by_profile: { display_name: string } | null })
    | null;
  if (!movie) notFound();

  const isTv = movie.media_type === "tv";
  const details = isTv
    ? await getTvDetails(movie.tmdb_id)
    : await getMovieDetails(movie.tmdb_id);

  const info = details.data;
  const tv = info && "number_of_seasons" in info ? info : null;
  const film = info && "runtime" in info ? info : null;
  const trailer = pickTrailer(info?.videos?.results);
  const watch = pickWatchRegion(info?.["watch/providers"]?.results);
  const posterPath = info?.poster_path ?? movie.poster_path;
  const overview = info?.overview || movie.overview;
  const addedByName = movie.added_by_profile?.display_name ?? "неизвестно";
  const noun = isTv ? "сериал" : "фильм";

  // "2019–2023" for a finished series, "2019–…" for one still running.
  let years = movie.year ? String(movie.year) : null;
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

  // Season 0 holds specials; it is not part of the main run.
  const seasons = (tv?.seasons ?? []).filter(
    (season) => season.season_number > 0 && season.episode_count > 0,
  );

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

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6">
        <Link
          href="/"
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
              alt={movie.title}
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
                {movie.title}
              </h1>
              {movie.original_title && movie.original_title !== movie.title && (
                <p className="mt-1 text-sm text-zinc-500">
                  {movie.original_title}
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

            <p className="text-xs text-zinc-500">
              добавил(а): {addedByName} ·{" "}
              {movie.status === "watched" ? "уже посмотрели" : "хотим посмотреть"}
            </p>

            <div className="w-fit">
              <StatusToggle movieId={movie.id} status={movie.status} />
            </div>

            {details.error && (
              <p role="alert" className="text-xs text-red-400">
                Не удалось загрузить подробности из TMDB: {details.error}
              </p>
            )}
          </div>
        </section>

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
                <SeasonRow key={season.id} season={season} />
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
                  providers={watch.providers.flatrate}
                />
                <ProviderRow
                  label="Бесплатно"
                  providers={[
                    ...(watch.providers.free ?? []),
                    ...(watch.providers.ads ?? []),
                  ]}
                />
                <ProviderRow label="Аренда" providers={watch.providers.rent} />
                <ProviderRow label="Покупка" providers={watch.providers.buy} />
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

function SeasonRow({ season }: { season: TmdbSeason }) {
  const year = yearOf(season.air_date);
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
      <span className="min-w-0 truncate text-sm text-zinc-200">
        {season.name}
      </span>
      <span className="flex-none text-xs text-zinc-500">
        {[year, plural(season.episode_count, ["серия", "серии", "серий"])]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </li>
  );
}

function ProviderRow({
  label,
  providers,
}: {
  label: string;
  providers: TmdbProvider[] | undefined;
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
        {unique.map((p) => (
          <li
            key={p.provider_id}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-3"
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
          </li>
        ))}
      </ul>
    </div>
  );
}
