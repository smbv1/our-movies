import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { preconnect } from "react-dom";
import ServiceWorker from "@/components/ServiceWorker";
import Toaster from "@/components/Toaster";
import { TMDB_IMAGE_ORIGIN } from "@/lib/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Наши фильмы",
  description: "Общий список фильмов для просмотра",
  appleWebApp: { title: "Наши фильмы", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Posters come from TMDB's CDN; open the connection before the first <img> asks for it.
  preconnect(TMDB_IMAGE_ORIGIN);

  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-950 text-zinc-100">
        {/* Installed on iOS the page runs under a see-through status bar; this keeps scrolled content from showing behind the clock. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-stone-950"
        />
        <Toaster>{children}</Toaster>
        {/* TMDB's terms ask apps using its API to credit it and say they aren't endorsed by it. */}
        <footer className="mt-auto px-4 pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-zinc-600">
          Данные о фильмах, сериалах и постеры:{" "}
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300"
          >
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </footer>
        <ServiceWorker />
      </body>
    </html>
  );
}
