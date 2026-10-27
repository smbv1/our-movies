import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AddTitleButtons from "@/components/AddTitleButtons";
import TitleDetails from "@/components/TitleDetails";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getMovieDetails, getTvDetails } from "@/lib/tmdb";
import type { MovieStatus, SearchResult } from "@/lib/types";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

function parseYear(date: string | null): number | null {
  const year = parseInt(date?.slice(0, 4) ?? "", 10);
  return Number.isNaN(year) ? null : year;
}

// A title opened from search, before it is in the list: details plus "add" buttons.
export default async function TitlePreviewPage({
  params,
  searchParams,
}: PageProps<"/title/[type]/[tmdbId]">) {
  const [{ type, tmdbId: rawId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const tmdbId = Number(rawId);
  if (
    (type !== "movie" && type !== "tv") ||
    !Number.isInteger(tmdbId) ||
    tmdbId <= 0
  ) {
    notFound();
  }
  // The tab search was opened from; its status goes first and the back link returns to it.
  const tab: MovieStatus = query.tab === "watched" ? "watched" : "want";

  const supabase = await createClient();
  // RLS only returns rows from the user's own list.
  const [userId, existingRes, details] = await Promise.all([
    getUserId(supabase),
    supabase
      .from("movies")
      .select("id")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", type)
      .maybeSingle(),
    type === "tv" ? getTvDetails(tmdbId) : getMovieDetails(tmdbId),
  ]);
  if (!userId) redirect("/login");
  // Already in the list: show the regular page with its status toggle.
  if (existingRes.data) redirect(`/movies/${existingRes.data.id}`);

  const info = details.data;
  if (!info) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6">
        <Link
          href={`/?tab=${tab}`}
          className="w-fit text-sm text-zinc-400 transition hover:text-zinc-100"
        >
          ← К списку
        </Link>
        <p role="alert" className="text-sm text-red-400">
          Не удалось загрузить подробности из TMDB: {details.error}
        </p>
      </div>
    );
  }

  const movie: SearchResult =
    "name" in info
      ? {
          tmdb_id: tmdbId,
          media_type: "tv",
          title: info.name,
          original_title: info.original_name || null,
          year: parseYear(info.first_air_date),
          poster_path: info.poster_path,
          overview: info.overview || null,
        }
      : {
          tmdb_id: tmdbId,
          media_type: "movie",
          title: info.title,
          original_title: info.original_title || null,
          year: parseYear(info.release_date),
          poster_path: info.poster_path,
          overview: info.overview || null,
        };

  return (
    <TitleDetails
      base={movie}
      info={info}
      detailsError={null}
      backHref={`/?tab=${tab}`}
    >
      <p className="text-xs text-zinc-500">Ещё не в нашем списке</p>
      <AddTitleButtons movie={movie} preferred={tab} />
    </TitleDetails>
  );
}
