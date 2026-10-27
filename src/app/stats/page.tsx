import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Movie } from "@/lib/types";
import StatsView from "./stats-view";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

export const metadata = { title: "Статистика пары · Наши фильмы" };

export default async function StatsPage() {
  const supabase = await createClient();
  const [userId, listRes, membersRes, moviesRes] = await Promise.all([
    getUserId(supabase),
    supabase.from("lists").select("*").maybeSingle(),
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("created_at", { ascending: true }),
    supabase.from("movies").select("*"),
  ]);
  if (!userId) redirect("/login");
  if (!listRes.data) redirect("/onboarding");

  // Rows and lists read before migrations 0007/0008 have run lack these columns.
  const movies: Movie[] = (moviesRes.data ?? []).map((m) => ({
    ...m,
    ratings: m.ratings ?? {},
    runtime: m.runtime ?? null,
    episodes: m.episodes ?? null,
    providers: m.providers ?? null,
    providers_region: m.providers_region ?? null,
  }));

  return (
    <StatsView
      movies={movies}
      members={membersRes.data ?? []}
      services={listRes.data.services ?? []}
    />
  );
}
