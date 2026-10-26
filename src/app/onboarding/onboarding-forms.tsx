"use client";

import { useActionState } from "react";
import { createList, joinList } from "./actions";
import { buttonClass, inputClass } from "@/app/auth/auth-card";
import Spinner from "@/components/Spinner";

export function OnboardingForms() {
  const [createState, createAction, creating] = useActionState(createList, {});
  const [joinState, joinAction, joining] = useActionState(joinList, {});

  return (
    <div className="space-y-6">
      <form action={createAction} className="space-y-3">
        <button
          type="submit"
          disabled={creating}
          className={`${buttonClass} inline-flex items-center justify-center gap-2`}
        >
          {creating && <Spinner />}
          {creating ? "Создаём..." : "Создать новый список"}
        </button>
        {createState.error && (
          <p role="alert" className="text-sm text-red-400">
            {createState.error}
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-500">
        <span className="h-px flex-1 bg-zinc-800" />
        или
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <form action={joinAction} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm text-zinc-400">Код приглашения</span>
          <input
            name="code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass} uppercase tracking-widest`}
          />
        </label>
        {joinState.error && (
          <p role="alert" className="text-sm text-red-400">
            {joinState.error}
          </p>
        )}
        <button
          type="submit"
          disabled={joining}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2.5 font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {joining && <Spinner />}
          {joining ? "Присоединяем..." : "Войти в список по коду"}
        </button>
      </form>
    </div>
  );
}
