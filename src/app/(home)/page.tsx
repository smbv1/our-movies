import Link from "next/link";
import { redirect } from "next/navigation";
import LiveSync from "@/components/LiveSync";
import Logo from "@/components/Logo";
import type { Member } from "@/components/MemberAvatar";
import MovieList from "@/components/MovieList";
import MovieSearch from "@/components/MovieSearch";
import PairButton from "@/components/PairButton";
import RandomPick from "@/components/RandomPick";
import TabPendingIndicator from "@/components/TabPendingIndicator";
import { createClient, getUserId } from "@/lib/supabase/server";
import { searchKey, type List, type Movie, type MovieStatus } from "@/lib/types";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { tab } = await searchParams;
  const activeTab = tab === "watched" ? "watched" : "want";

  const supabase = await createClient();
  // RLS scopes every table to the signed-in user's list, so nothing here needs
  // the profile first and all requests go out at once.
  const [userId, listRes, membersRes, moviesRes] = await Promise.all([
    getUserId(supabase),
    supabase.from("lists").select("id, name, invite_code").maybeSingle(),
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("created_at", { ascending: true }),
    supabase
      .from("movies")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);
  if (!userId) redirect("/login");

  const list: List | null = listRes.data;
  // Without a list the user only sees their own profile and no movies.
  if (!list) redirect("/onboarding");
  const members: Member[] = membersRes.data ?? [];
  const movies: Movie[] = moviesRes.data ?? [];

  const nameById = Object.fromEntries(
    members.map((m) => [m.id, m.display_name]),
  );
  const existing: Record<string, MovieStatus> = Object.fromEntries(
    movies.map((m) => [searchKey(m), m.status]),
  );
  const wantMovies = movies.filter((m) => m.status === "want");
  const watchedMovies = movies.filter((m) => m.status === "watched");
  const shown = activeTab === "watched" ? watchedMovies : wantMovies;

  const tabClass = (isActive: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
      isActive
        ? "bg-zinc-100 text-zinc-900 shadow"
        : "text-zinc-400 hover:text-zinc-100"
    }`;
  const countClass = (isActive: boolean) =>
    `rounded-full px-1.5 text-xs tabular-nums ${
      isActive ? "bg-zinc-900/10" : "bg-zinc-800"
    }`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between gap-3 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="h-9 w-9 flex-none" />
          <span className="truncate text-xl font-bold tracking-tight text-zinc-50">
            Наши фильмы
          </span>
        </Link>
        <PairButton members={members} inviteCode={list.invite_code} />
      </header>

      {/* Search and tabs stay on screen while the list scrolls. */}
      <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-2 border-b border-zinc-800/60 bg-stone-950/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:flex-row sm:items-center sm:px-6">
        <div className="sm:flex-1">
          <MovieSearch existing={existing} addAs={activeTab} />
        </div>
        <nav
          aria-label="Списки фильмов и сериалов"
          className="flex gap-1 rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800 sm:w-auto"
        >
          <Link
            href="/?tab=want"
            aria-current={activeTab === "want" ? "page" : undefined}
            className={tabClass(activeTab === "want")}
          >
            Хотим
            <span className={countClass(activeTab === "want")}>
              {wantMovies.length}
            </span>
            <TabPendingIndicator />
          </Link>
          <Link
            href="/?tab=watched"
            aria-current={activeTab === "watched" ? "page" : undefined}
            className={tabClass(activeTab === "watched")}
          >
            Посмотрели
            <span className={countClass(activeTab === "watched")}>
              {watchedMovies.length}
            </span>
            <TabPendingIndicator />
          </Link>
        </nav>
      </div>

      <main className="flex flex-col gap-5 pt-5">
        {activeTab === "want" && (
          <RandomPick
            movies={wantMovies}
            nameById={nameById}
            memberCount={members.length}
          />
        )}
        <MovieList
          movies={shown}
          members={members}
          meId={userId}
          tab={activeTab}
        />
      </main>
      <LiveSync listId={list.id} />
    </div>
  );
}
