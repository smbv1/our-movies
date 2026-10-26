import type { MetadataRoute } from "next";

// Lets the site be added to a phone's home screen and open like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Наши фильмы",
    short_name: "Наши фильмы",
    description: "Общий список фильмов и сериалов для просмотра вдвоём",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    lang: "ru",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
