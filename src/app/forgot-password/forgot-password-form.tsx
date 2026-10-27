"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { buttonClass, inputClass } from "@/app/auth/auth-card";
import Spinner from "@/components/Spinner";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  if (state.message) {
    return (
      <p role="status" className="text-center text-sm text-emerald-400">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-zinc-400">
        Пришлём на почту ссылку, по которой можно задать новый пароль.
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
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
        {pending ? "Отправляем..." : "Отправить ссылку"}
      </button>
    </form>
  );
}
