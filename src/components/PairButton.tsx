"use client";

import { useEffect, useState } from "react";
import { logout } from "@/app/auth/actions";
import LogoutButton from "@/components/LogoutButton";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import { useToast } from "@/components/Toaster";

type PairButtonProps = {
  members: Member[];
  inviteCode: string;
};

// The couple's avatars in the header; opens the invite code and the logout button.
export default function PairButton({ members, inviteCode }: PairButtonProps) {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.show({ message: "Код скопирован" });
    } catch {
      toast.show({ message: "Не удалось скопировать, выделите код вручную", tone: "error" });
    }
  }

  const alone = members.length < 2;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Наша пара: участники, код приглашения, выход"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 ring-1 ring-zinc-800 transition hover:bg-zinc-900"
      >
        <span className="flex -space-x-2">
          {members.map((m, i) => (
            <MemberAvatar
              key={m.id}
              name={m.display_name}
              index={i}
              size="sm"
              className="ring-2 ring-stone-950"
            />
          ))}
          {alone && (
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-zinc-600 bg-stone-950 text-xs text-zinc-500"
            >
              +
            </span>
          )}
        </span>
        <span className="text-sm text-zinc-300">{alone ? "Пригласить" : "Мы"}</span>
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pair-title"
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="pair-title" className="text-lg font-bold text-zinc-50">
                Наша пара
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <ul className="flex flex-col gap-2">
              {members.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 text-sm text-zinc-200">
                  <MemberAvatar name={m.display_name} index={i} size="md" />
                  {m.display_name}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 rounded-xl bg-zinc-950/60 p-4 ring-1 ring-zinc-800">
              <p className="text-xs text-zinc-400">
                {alone
                  ? "Отправьте этот код второй половинке. После регистрации пусть выберет «Войти в список по коду» и введёт его."
                  : "Код приглашения в ваш список"}
              </p>
              <div className="flex items-center gap-2">
                <span className="flex-1 select-all font-mono text-xl font-bold tracking-[0.3em] text-amber-400">
                  {inviteCode}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
                >
                  Копировать
                </button>
              </div>
            </div>

            <form action={logout} className="flex justify-end">
              <LogoutButton />
            </form>
          </div>
        </div>
      )}
    </>
  );
}
