import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SuggestionGrid, { type Suggestion } from "@/components/SuggestionGrid";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getPerson, toSearchResult, type TmdbPersonCredit } from "@/lib/tmdb";
import {
  DEPARTMENT_NAMES,
  searchKey,
  tmdbImage,
  type MovieStatus,
} from "@/lib/types";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

// Talk shows, news and reality TV: appearances as themselves, not roles.
const SELF_GENRES = new Set([10763, 10764, 10767]);

const DIRECTOR_JOBS = new Set(["Director", "Creator"]);

// One entry per title, most popular first, with the role (or job) under it.
function toSuggestions(
  credits: TmdbPersonCredit[],
  noteOf: (c: TmdbPersonCredit) => string | undefined,
): Suggestion[] {
  const seen = new Set<string>();
  const out: (Suggestion & { popularity: number })[] = [];
  for (const credit of [...credits].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
  )) {
    const movie = toSearchResult(credit);
    if (!movie) continue;
    const key = searchKey(movie);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ movie, note: noteOf(credit), popularity: credit.popularity ?? 0 });
  }
  return out.map(({ movie, note }) => ({ movie, note }));
}

// An actor's or director's films and series, to add the ones we want.
export default async function PersonPage({
  params,
  searchParams,
}: PageProps<"/person/[id]">) {
  const [{ id: rawId }, query] = await Promise.all([params, searchParams]);
  const personId = Number(rawId);
  if (!Number.isInteger(personId) || personId <= 0) notFound();
  // The tab search was opened from: titles are added there and the back link returns to it.
  const tab: MovieStatus = query.tab === "watched" ? "watched" : "want";

  const supabase = await createClient();
  // RLS only returns rows from the user's own list.
  const [userId, moviesRes, personRes] = await Promise.all([
    getUserId(supabase),
    supabase.from("movies").select("tmdb_id, media_type, status"),
    getPerson(personId),
  ]);
  if (!userId) redirect("/login");

  const backLink = (
    <Link
      href={`/?tab=${tab}`}
      className="w-fit text-sm text-zinc-400 transition hover:text-zinc-100"
    >
      ← К списку
    </Link>
  );

  const person = personRes.data;
  if (!person) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6">
        {backLink}
        <p role="alert" className="text-sm text-red-400">
          Не удалось загрузить фильмографию из TMDB: {personRes.error}
        </p>
      </div>
    );
  }

  const existing: Record<string, MovieStatus> = Object.fromEntries(
    (moviesRes.data ?? []).map((m) => [searchKey(m), m.status as MovieStatus]),
  );
  const cast = (person.combined_credits?.cast ?? []).filter(
    (c) =>
      !c.genre_ids?.some((g) => SELF_GENRES.has(g)) &&
      !/^(self|himself|herself|сам|сама)\b/i.test(c.character ?? ""),
  );
  const directed = (person.combined_credits?.crew ?? []).filter((c) =>
    DIRECTOR_JOBS.has(c.job ?? ""),
  );
  const acting = toSuggestions(cast, (c) =>
    c.character ? `роль: ${c.character}` : undefined,
  );
  const directing = toSuggestions(directed, (c) =>
    c.job === "Creator" ? "создатель" : undefined,
  );
  // A director's own films come first on their page, an actor's roles on theirs.
  const directorFirst = person.known_for_department === "Directing";
  const inList = [...acting, ...directing].filter(
    (s, i, all) =>
      existing[searchKey(s.movie)] &&
      all.findIndex((o) => searchKey(o.movie) === searchKey(s.movie)) === i,
  ).length;

  const sections: { title: string; items: Suggestion[] }[] = [
    { title: "Режиссёр", items: directing },
    { title: "Актёр", items: acting },
  ];
  if (!directorFirst) sections.reverse();

  const years = [person.birthday?.slice(0, 4), person.deathday?.slice(0, 4)]
    .filter(Boolean)
    .join("–");
  const facts = [
    person.known_for_department
      ? (DEPARTMENT_NAMES[person.known_for_department] ?? null)
      : null,
    years || null,
    person.place_of_birth,
  ].filter(Boolean);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      {backLink}

      <section className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {person.profile_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tmdbImage(person.profile_path, "w185")}
            alt={person.name}
            fetchPriority="high"
            className="aspect-[2/3] w-32 shrink-0 self-center rounded-xl object-cover shadow-lg sm:w-40 sm:self-start"
          />
        ) : (
          <div className="flex aspect-[2/3] w-32 shrink-0 items-center justify-center self-center rounded-xl bg-zinc-800 text-4xl sm:w-40 sm:self-start">
            👤
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-3xl">
            {person.name}
          </h1>
          {facts.length > 0 && (
            <p className="text-sm text-zinc-300">{facts.join(" · ")}</p>
          )}
          {inList > 0 && (
            <p className="text-sm text-emerald-400">
              Уже в нашем списке: {inList}
            </p>
          )}
          {person.biography && (
            <p className="line-clamp-6 text-sm leading-relaxed text-zinc-400">
              {person.biography}
            </p>
          )}
        </div>
      </section>

      {sections
        .filter((s) => s.items.length > 0)
        .map((s) => (
          <section key={s.title} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">
              {s.title}{" "}
              <span className="text-sm font-normal text-zinc-500">
                {s.items.length}
              </span>
            </h2>
            <SuggestionGrid
              items={s.items}
              existing={existing}
              addAs={tab}
              typeFilter
            />
          </section>
        ))}

      {acting.length === 0 && directing.length === 0 && (
        <p className="text-sm text-zinc-500">
          TMDB не знает фильмов и сериалов с этим человеком.
        </p>
      )}
    </div>
  );
}
