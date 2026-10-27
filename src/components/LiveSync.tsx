"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type LiveSyncProps = {
  listId: string;
};

// Several changes often land together (a toggle and its undo, a burst of adds),
// so they are folded into one refresh.
const REFRESH_DELAY_MS = 400;

// Re-renders the page when anyone in the list adds, changes or removes a title,
// so the partner's changes show up without reloading. Renders nothing.
export default function LiveSync({ listId }: LiveSyncProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    };

    const channel = supabase
      .channel(`list-${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movies", filter: `list_id=eq.${listId}` },
        refreshSoon,
      )
      // Deletes carry only the row id, so the list filter can't match them; RLS
      // still keeps other lists' rows out, and a stray refresh is harmless.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "movies" },
        refreshSoon,
      )
      .subscribe();

    // Phones drop the socket in the background; catch up on whatever was missed.
    function onVisible() {
      if (document.visibilityState === "visible") refreshSoon();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [listId, router]);

  return null;
}
