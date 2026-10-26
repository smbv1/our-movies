"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

export async function createList(): Promise<OnboardingState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_list");

  if (error) {
    return { error: "Не удалось создать список, попробуй ещё раз" };
  }

  redirect("/");
}

export async function joinList(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return { error: "Введите код приглашения" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_list", { code });

  if (error) {
    return { error: "Неверный код" };
  }

  redirect("/");
}
