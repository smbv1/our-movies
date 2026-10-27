import { notFound, redirect } from "next/navigation";
import MovieRatings from "@/components/MovieRatings";
import StatusToggle from "@/components/StatusToggle";
import TitleDetails from "@/components/TitleDetails";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getMovieDetails, getTvDetails } from "@/lib/tmdb";
import type { Movie } from "@/lib/types";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MoviePage({ params }: PageProps<"/movies/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  // RLS only returns movies from the user's own list; the adder's name comes embedded.
  const [userId, movieRes, membersRes] = await Promise.all([
    getUserId(supabase),
    supabase
      .from("movies")
      .select("*, added_by_profile:profiles!movies_added_by_fkey(display_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("created_at", { ascending: true }),
  ]);
  if (!userId) redirect("/login");
  const movie = movieRes.data as
    | (Movie & { added_by_profile: { display_name: string } | null })
    | null;
  if (!movie) notFound();

  const details =
    movie.media_type === "tv"
      ? await getTvDetails(movie.tmdb_id)
      : await getMovieDetails(movie.tmdb_id);
  const addedByName = movie.added_by_profile?.display_name ?? "неизвестно";
  // Me first, matching the cards in the list.
  const raters = (membersRes.data ?? [])
    .map((m, index) => ({ ...m, index }))
    .sort((a, b) => Number(b.id === userId) - Number(a.id === userId));

  return (
    <TitleDetails
      base={movie}
      info={details.data}
      detailsError={details.error}
      backHref={`/?tab=${movie.status}`}
    >
      <p className="text-xs text-zinc-500">
        добавил(а): {addedByName} ·{" "}
        {movie.status === "watched" ? "уже посмотрели" : "хотим посмотреть"}
      </p>

      <div className="w-fit">
        <StatusToggle movieId={movie.id} status={movie.status} />
      </div>

      {movie.status === "watched" && movie.ratings && (
        <MovieRatings
          movieId={movie.id}
          members={raters}
          meId={userId}
          ratings={movie.ratings}
        />
      )}
    </TitleDetails>
  );
}
