"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/auth/actions";
import { buttonClass, inputClass } from "@/app/auth/auth-card";
import Spinner from "@/components/Spinner";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Новый пароль</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Ещё раз</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} inline-flex items-center justify-center gap-2`}
      >
        {pending && <Spinner />}
        {pending ? "Сохраняем..." : "Сохранить пароль"}
      </button>
    </form>
  );
}
