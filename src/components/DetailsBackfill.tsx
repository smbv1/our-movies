"use client";

import { useEffect } from "react";
import { fillMissingDetails } from "@/app/movies/actions";

type DetailsBackfillProps = {
  // Titles in the list still without genres and runtime.
  missing: number;
};

// Titles added before genres were stored get them from TMDB in the background.
// Each batch that lands re-renders the page with a smaller count, which starts the
// next one; if TMDB fails, the count stays put and it stops. Renders nothing.
export default function DetailsBackfill({ missing }: DetailsBackfillProps) {
  useEffect(() => {
    if (missing > 0) void fillMissingDetails();
  }, [missing]);

  return null;
}
