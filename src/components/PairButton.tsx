"use client";

import { useActionState, useEffect, useState } from "react";
import { logout } from "@/app/auth/actions";
import { joinPartnerList, type JoinPartnerState } from "@/app/onboarding/actions";
import LogoutButton from "@/components/LogoutButton";
import MemberAvatar, { type Member } from "@/components/MemberAvatar";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";

type PairButtonProps = {
  members: Member[];
  inviteCode: string;
};

// The couple's avatars in the header; opens the invite code, joining the partner's
// list by their code (for whoever skipped it at sign-up) and the logout button.
export default function PairButton({ members, inviteCode }: PairButtonProps) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [joinState, joinAction, joining] = useActionState(
    async (prev: JoinPartnerState, formData: FormData) => {
      const next = await joinPartnerList(prev, formData);
      if (next.joined) {
        setOpen(false);
        toast.show({ message: "Готово, теперь у вас общий список" });
      }
      return next;
    },
    {},
  );

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
                  ? "Отправьте этот код второй половинке. Пусть введёт его в «Наша пара» у себя или при регистрации."
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

            {alone && (
              <form action={joinAction} className="flex flex-col gap-2">
                <label htmlFor="partner-code" className="text-xs text-zinc-400">
                  Уже есть код от второй половинки? Введите его, чтобы войти в
                  общий список. Ваши фильмы перенесутся туда.
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="partner-code"
                    name="code"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={12}
                    placeholder="Код"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono uppercase tracking-widest text-zinc-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={joining}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {joining && <Spinner />}
                    {joining ? "Входим..." : "Войти"}
                  </button>
                </div>
                {joinState.error && (
                  <p role="alert" className="text-sm text-red-400">
                    {joinState.error}
                  </p>
                )}
              </form>
            )}

            <form action={logout} className="flex justify-end">
              <LogoutButton />
            </form>
          </div>
        </div>
      )}
    </>
  );
}
