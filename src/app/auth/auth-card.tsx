import type { ReactNode } from "react";
import Logo from "@/components/Logo";

export const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20";

export const buttonClass =
  "w-full rounded-lg bg-amber-400 px-4 py-2.5 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50";

// Centered card used by the login and signup pages.
export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-3">
          <Logo className="h-14 w-14" />
          <p className="text-sm font-medium text-zinc-400">Наши фильмы</p>
          <h1 className="text-center text-2xl font-semibold">{title}</h1>
        </div>
        {children}
        <div className="text-center text-sm text-zinc-400">{footer}</div>
      </div>
    </main>
  );
}
