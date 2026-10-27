"use client";

import { useEffect } from "react";

// Registers public/sw.js, which shows an offline page instead of the browser's
// error when the installed app opens without a connection.
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Not fatal: the site works the same, just without the offline page.
      });
  }, []);
  return null;
}
