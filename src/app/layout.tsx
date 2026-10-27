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
        <ServiceWorker />
      </body>
    </html>
  );
}
