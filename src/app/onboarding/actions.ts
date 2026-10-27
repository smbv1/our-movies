"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };
export type JoinPartnerState = OnboardingState & { joined?: boolean };

// join_list answers a wrong code with an empty row, and raises for the other failures.
async function joinByCode(code: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_list", { code });

  if (error) {
    if (error.message.includes("too many attempts")) {
      return "Слишком много неверных кодов. Попробуйте через час";
    }
    if (error.message.includes("list is full")) {
      return "В этом списке уже двое";
    }
    return "Не удалось войти в список, попробуйте ещё раз";
  }
  if (!data?.id) {
    return "Неверный код";
  }
  return null;
}

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

  const error = await joinByCode(code);
  if (error) {
    return { error };
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

  const error = await joinByCode(code);
  if (error) {
    return { error };
  }

  revalidatePath("/");
  return { joined: true };
}

// Replaces the list's invite code, so an old code that leaked stops working.
export async function regenerateInviteCode(): Promise<{
  code?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_invite_code");

  if (error || !data) {
    return { error: "Не удалось сменить код" };
  }

  revalidatePath("/");
  return { code: data };
}
