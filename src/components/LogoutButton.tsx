"use client";

import { useFormStatus } from "react-dom";
import Spinner from "@/components/Spinner";

export default function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending && <Spinner />}
      {pending ? "Выходим…" : "Выйти"}
    </button>
  );
}
