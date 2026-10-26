"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };
export type JoinPartnerState = OnboardingState & { joined?: boolean };

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

// Same as joinList, for someone who already has a list (the "Наша пара" dialog):
// stays on the page so the dialog can confirm instead of redirecting.
export async function joinPartnerList(
  _prev: JoinPartnerState,
  formData: FormData,
): Promise<JoinPartnerState> {
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return { error: "Введите код приглашения" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_list", { code });

  if (error) {
    return { error: "Неверный код" };
  }

  revalidatePath("/");
  return { joined: true };
}
