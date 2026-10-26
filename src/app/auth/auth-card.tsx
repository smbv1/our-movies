import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-400";

export const buttonClass =
  "w-full rounded-lg bg-zinc-100 px-4 py-2.5 font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50";

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
        <h1 className="text-center text-2xl font-semibold">{title}</h1>
        {children}
        <div className="text-center text-sm text-zinc-400">{footer}</div>
      </div>
    </main>
  );
}
