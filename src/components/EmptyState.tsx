import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
};

export default function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/15 to-rose-500/15 text-3xl ring-1 ring-white/5"
      >
        {icon}
      </div>
      <p className="text-base font-semibold text-zinc-100">{title}</p>
      {hint && <p className="max-w-sm text-sm text-zinc-400">{hint}</p>}
      {action}
    </div>
  );
}
