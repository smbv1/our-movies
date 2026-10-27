import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { loadSwipeDeck } from "@/lib/swipe";
import SwipeView from "./swipe-view";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

export const metadata = { title: "Свайпы · Наши фильмы" };

type PageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function SwipePage({ searchParams }: PageProps) {
  const { type } = await searchParams;
  const kind = type === "tv" ? "tv" : "movie";

  const supabase = await createClient();
  const [userId, listRes, membersRes, deck] = await Promise.all([
    getUserId(supabase),
    supabase.from("lists").select("id").maybeSingle(),
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("created_at", { ascending: true }),
    loadSwipeDeck(kind, 1),
  ]);
  if (!userId) redirect("/login");
  if (!listRes.data) redirect("/onboarding");

  return (
    <SwipeView
      // A fresh deck when switching between films and series.
      key={kind}
      kind={kind}
      initialDeck={deck}
      listId={listRes.data.id}
      meId={userId}
      members={membersRes.data ?? []}
    />
  );
}
