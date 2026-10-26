"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Введите email и пароль" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Сначала подтверди email по письму" };
    }
    return { error: "Неверный email или пароль" };
  }

  redirect("/");
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!displayName) {
    return { error: "Введите имя" };
  }
  if (!email) {
    return { error: "Введите email" };
  }
  if (password.length < 6) {
    return { error: "Пароль должен быть не короче 6 символов" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Этот email уже зарегистрирован" };
    }
    return { error: "Не удалось зарегистрироваться, попробуй ещё раз" };
  }

  if (data.session) {
    redirect("/");
  }

  return { message: "Проверь почту и подтверди email, потом войди" };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
