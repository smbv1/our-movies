import Link from "next/link";
import type { ReactNode } from "react";
import EmptyState from "@/components/EmptyState";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import ServicesButton, { ProviderLogo } from "@/components/ServicesButton";
import { coupleStats } from "@/lib/stats";
import {
  averageRating,
  capitalize,
  plural,
  type Movie,
  type StoredProvider,
} from "@/lib/types";

// "42 часа", or "3 ч 20 мин" below ten hours, where minutes still matter.
function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 10) {
    const h = Math.floor(hours);
    const m = Math.round(minutes - h * 60);
    return h === 0 ? `${m} мин` : m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
  }
  return plural(Math.round(hours), ["час", "часа", "часов"]);
}

const score = (n: number) => n.toFixed(1).replace(".", ",");

type StatsViewProps = {
  movies: Movie[];
  members: Member[];
  // Provider ids of the couple's streaming services.
  services: number[];
};

// The couple's numbers: what and how much they watch, how their scores compare,
// and where the titles they still want stream.
export default function StatsView({
  movies,
  members,
  services,
}: StatsViewProps) {
  const stats = coupleStats(
    movies,
    members.map((m) => m.id),
    services,
    new Date(),
  );
  const pair = members.length > 1;
  const watchedTotal = stats.watchedFilms + stats.watchedSeries;
  const ratedByAll =
    stats.verdicts.match + stats.verdicts.close + stats.verdicts.apart;
  const monthMax = Math.max(1, ...stats.months.map((m) => m.count));
  const genreMax = Math.max(1, ...stats.genres.map((g) => g.count));
  const allProviders: StoredProvider[] = [
    ...new Map(
      movies.flatMap((m) => m.providers ?? []).map((p) => [p.id, p]),
    ).values(),
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 pb-24 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      <Link
        href="/"
        className="w-fit text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        ← К списку
      </Link>
      <div className="flex items-center gap-3">
        <span className="flex -space-x-2">
          {members.map((m, i) => (
            <MemberAvatar
              key={m.id}
              name={m.display_name}
              index={i}
              size="md"
              className="ring-2 ring-stone-950"
            />
          ))}
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          {pair ? "Наша статистика" : "Моя статистика"}
        </h1>
      </div>

      {watchedTotal === 0 && stats.wantCount === 0 ? (
        <EmptyState
          icon="📊"
          title="Пока считать нечего"
          hint="Добавьте фильмы и отмечайте просмотренные, здесь появятся ваши цифры."
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Посмотрели"
              value={String(watchedTotal)}
              hint={[
                plural(stats.watchedFilms, ["фильм", "фильма", "фильмов"]),
                plural(stats.watchedSeries, ["сериал", "сериала", "сериалов"]),
              ].join(" и ")}
            />
            <StatTile
              label={pair ? "Провели вместе" : "У экрана"}
              value={
                stats.watchedMinutes > 0
                  ? formatHours(stats.watchedMinutes)
                  : "—"
              }
              hint={
                stats.unknownLength > 0
                  ? `без ${stats.unknownLength} с неизвестной длиной`
                  : stats.watchedMinutes >= 24 * 60
                    ? `≈ ${plural(Math.round(stats.watchedMinutes / 60 / 24), ["сутки", "суток", "суток"])} подряд`
                    : "сериалы целиком"
              }
            />
            <StatTile
              label="В этом году"
              value={String(stats.watchedThisYear)}
              hint="отмечено просмотренным"
            />
            <StatTile
              label="Ещё хотим"
              value={String(stats.wantCount)}
              hint={
                stats.wantMinutes > 0
                  ? `≈ ${formatHours(stats.wantMinutes)} впереди`
                  : "в списке «Хотим»"
              }
            />
          </section>

          {watchedTotal > 0 && (
            <Card title="Сколько смотрим по месяцам">
              <ol
                className="flex h-40 items-end gap-1.5 sm:gap-2"
                aria-label="Просмотрено по месяцам, за последний год"
              >
                {stats.months.map((m) => (
                  <li
                    key={m.key}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
                    title={`${m.label}: ${m.count}`}
                  >
                    <span className="text-[10px] tabular-nums text-zinc-400">
                      {m.count > 0 ? m.count : ""}
                    </span>
                    <span
                      className={`w-full max-w-8 rounded-t ${
                        m.count > 0
                          ? "bg-amber-400 group-hover:bg-amber-300"
                          : "bg-zinc-800"
                      }`}
                      style={{
                        height:
                          m.count > 0
                            ? `${(m.count / monthMax) * 100}%`
                            : "2px",
                      }}
                    />
                    <span className="text-[10px] text-zinc-500">{m.label}</span>
                    <span className="sr-only">: {m.count}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {stats.genres.length > 0 && (
            <Card
              title="Любимые жанры"
              hint="Сколько посмотрели в каждом жанре и ваша средняя оценка"
            >
              <ul className="flex flex-col gap-2.5">
                {stats.genres.map((g) => (
                  <li
                    key={g.genre}
                    className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_auto]"
                  >
                    <span className="truncate text-zinc-200">
                      {capitalize(g.genre)}
                    </span>
                    <span className="h-2.5 rounded-full bg-zinc-800">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${(g.count / genreMax) * 100}%` }}
                      />
                    </span>
                    <span className="w-16 text-right text-xs tabular-nums text-zinc-400">
                      {g.count}
                      {g.avg !== null && (
                        <span className="text-zinc-500">
                          {" "}
                          · ★{score(g.avg)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {stats.members.some((m) => m.rated > 0) && (
            <Card title="Оценки">
              <div className="grid gap-3 sm:grid-cols-2">
                {stats.members.map((s, i) => {
                  const member = members[i];
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl bg-zinc-950/50 p-3 ring-1 ring-zinc-800"
                    >
                      <MemberAvatar
                        name={member.display_name}
                        index={i}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {member.display_name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {s.avg !== null
                            ? `в среднем ★${score(s.avg)} · ${plural(s.rated, ["оценка", "оценки", "оценок"])}`
                            : "пока без оценок"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {pair && ratedByAll > 0 && (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-zinc-200">
                      Совпадаем во вкусах в{" "}
                      <span className="font-semibold text-amber-400">
                        {Math.round((stats.verdicts.match / ratedByAll) * 100)}%
                      </span>{" "}
                      случаев
                    </p>
                    {/* One stacked bar: agreed, close, apart. */}
                    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                      {(
                        [
                          ["match", "bg-emerald-400", "совпали"],
                          ["close", "bg-zinc-500", "близко"],
                          ["apart", "bg-rose-400", "разошлись"],
                        ] as const
                      ).map(([key, color, label]) =>
                        stats.verdicts[key] > 0 ? (
                          <span
                            key={key}
                            title={`${label}: ${stats.verdicts[key]}`}
                            className={color}
                            style={{ flexGrow: stats.verdicts[key] }}
                          />
                        ) : null,
                      )}
                    </div>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                      <Legend color="bg-emerald-400">
                        совпали (±1): {stats.verdicts.match}
                      </Legend>
                      <Legend color="bg-zinc-500">
                        близко: {stats.verdicts.close}
                      </Legend>
                      <Legend color="bg-rose-400">
                        разошлись (3+): {stats.verdicts.apart}
                      </Legend>
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TitleList
                      title="Понравилось обоим"
                      movies={stats.bestTogether}
                      members={members}
                    />
                    {stats.biggestSplits.length > 0 && (
                      <TitleList
                        title="Где разошлись сильнее всего"
                        movies={stats.biggestSplits}
                        members={members}
                      />
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {pair && (
            <Card title="Кто что приносит">
              <ul className="grid gap-3 sm:grid-cols-2">
                {stats.members.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 text-sm text-zinc-300"
                  >
                    <MemberAvatar
                      name={members[i].display_name}
                      index={i}
                      size="sm"
                    />
                    <span>
                      <span className="font-medium text-zinc-100">
                        {members[i].display_name}
                      </span>{" "}
                      добавил(а){" "}
                      {plural(s.added, ["тайтл", "тайтла", "тайтлов"])}, хочет{" "}
                      {s.wants} из «Хотим»
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title="Где смотреть то, что хотим"
            hint="Подписки и бесплатные сервисы по данным JustWatch. Для Кыргызстана данных мало, поэтому часто показаны Казахстан, Россия или США."
            action={
              <ServicesButton
                providers={allProviders}
                services={services}
                className="inline-flex h-8 flex-none items-center gap-1.5 rounded-full bg-zinc-900 px-3 text-xs font-medium text-zinc-300 ring-1 ring-zinc-800 transition hover:text-zinc-100"
              />
            }
          >
            {stats.wantProviders.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Для фильмов из «Хотим» сервисы пока не найдены.
              </p>
            ) : (
              <>
                {services.length > 0 && (
                  <p className="text-sm text-zinc-200">
                    На ваших сервисах есть{" "}
                    <span className="font-semibold text-amber-400">
                      {stats.wantOnOurServices}
                    </span>{" "}
                    из {stats.wantCount} в «Хотим»
                  </p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {stats.wantProviders
                    .slice(0, 12)
                    .map(({ provider, count }) => {
                      const ours = services.includes(provider.id);
                      return (
                        <li
                          key={provider.id}
                          className={`flex items-center gap-2 rounded-lg border py-1 pl-1 pr-3 text-sm ${
                            ours
                              ? "border-amber-400/60 bg-amber-400/10"
                              : "border-zinc-800 bg-zinc-950/50"
                          }`}
                        >
                          <ProviderLogo provider={provider} size="md" />
                          <span className="text-zinc-200">{provider.name}</span>
                          <span className="tabular-nums text-zinc-500">
                            {count}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
        {value}
      </p>
      <p className="text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function Card({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-zinc-800 sm:p-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`h-2 w-2 rounded-full ${color}`} />
      {children}
    </span>
  );
}

// A few titles with each member's score.
function TitleList({
  title,
  movies,
  members,
}: {
  title: string;
  movies: Movie[];
  members: Member[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wide text-zinc-500">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {movies.map((m) => (
          <li key={m.id}>
            <Link
              href={`/movies/${m.id}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-zinc-800"
            >
              <span className="min-w-0 truncate text-zinc-200">{m.title}</span>
              <span className="flex flex-none items-center gap-2 text-xs tabular-nums text-zinc-400">
                {members.map((p, i) => (
                  <span key={p.id} className="flex items-center gap-1">
                    <MemberAvatar name={p.display_name} index={i} size="xs" />
                    {m.ratings[p.id]}
                  </span>
                ))}
                <span className="sr-only">
                  в среднем {score(averageRating(m.ratings) ?? 0)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
