import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { preconnect } from "react-dom";
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
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
