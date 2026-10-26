import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import MovieCard from "@/components/MovieCard";
import MovieSearch from "@/components/MovieSearch";
import { createClient } from "@/lib/supabase/server";
import type { List, Movie, Profile } from "@/lib/types";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

type Member = { id: string; display_name: string };

export default async function Home({ searchParams }: PageProps) {
  const { tab } = await searchParams;
  const activeTab = tab === "watched" ? "watched" : "want";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileRes = await supabase
    .from("profiles")
    .select("id, display_name, list_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile: Profile | null = profileRes.data;
  if (!profile?.list_id) redirect("/onboarding");
  const listId = profile.list_id;

  const [listRes, membersRes, moviesRes] = await Promise.all([
    supabase
      .from("lists")
      .select("id, name, invite_code")
      .eq("id", listId)
      .single(),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("list_id", listId),
    supabase
      .from("movies")
      .select("*")
      .eq("list_id", listId)
      .order("created_at", { ascending: false }),
  ]);

  const list: List | null = listRes.data;
  const members: Member[] = membersRes.data ?? [];
  const movies: Movie[] = moviesRes.data ?? [];

  if (!list) redirect("/onboarding");

  const nameById = new Map(members.map((m) => [m.id, m.display_name]));
  const wantMovies = movies.filter((m) => m.status === "want");
  const watchedMovies = movies.filter((m) => m.status === "watched");
  const shown = activeTab === "watched" ? watchedMovies : wantMovies;

  const tabClass = (isActive: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition ${
      isActive
        ? "bg-zinc-800 text-zinc-50"
        : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            Наши фильмы
          </h1>
          {members.length > 0 && (
            <p className="mt-1 text-sm text-zinc-400">
              {members.map((m) => m.display_name).join(", ")}
            </p>
          )}
          <p className="mt-1 text-sm text-zinc-500">
            Код для приглашения:{" "}
            <span className="font-mono font-semibold tracking-widest text-amber-400">
              {list.invite_code}
            </span>
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
          >
            Выйти
          </button>
        </form>
      </header>

      <MovieSearch />

      <nav
        aria-label="Списки фильмов"
        className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1"
      >
        <Link
          href="/?tab=want"
          aria-current={activeTab === "want" ? "page" : undefined}
          className={tabClass(activeTab === "want")}
        >
          Хотим посмотреть ({wantMovies.length})
        </Link>
        <Link
          href="/?tab=watched"
          aria-current={activeTab === "watched" ? "page" : undefined}
          className={tabClass(activeTab === "watched")}
        >
          Посмотрели ({watchedMovies.length})
        </Link>
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {activeTab === "watched"
            ? "Пока ни один фильм не отмечен как просмотренный."
            : "Список пуст. Найдите фильм выше и добавьте его."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((movie) => (
            <li key={movie.id}>
              <MovieCard
                movie={movie}
                addedByName={nameById.get(movie.added_by) ?? "неизвестно"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
