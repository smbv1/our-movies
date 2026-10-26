"use client";

import { useActionState } from "react";
import { signup } from "@/app/auth/actions";
import { buttonClass, inputClass } from "@/app/auth/auth-card";
import Spinner from "@/components/Spinner";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, {});

  if (state.message) {
    return (
      <p role="status" className="text-center text-zinc-200">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Имя</span>
        <input
          name="display_name"
          type="text"
          required
          autoComplete="nickname"
          className={inputClass}
        />
      </label>
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
      <label className="block space-y-1.5">
        <span className="text-sm text-zinc-400">Пароль (минимум 6 символов)</span>
        <input
          name="password"
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
        {pending ? "Создаём аккаунт..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
