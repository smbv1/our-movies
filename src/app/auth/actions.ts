"use server";

import { headers } from "next/headers";
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

// Emails a link that signs the user in and opens /reset-password.
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Введите email" };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("x-forwarded-host") ?? headerList.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    if (error.status === 429) {
      return { error: "Слишком много запросов, попробуй через минуту" };
    }
    return { error: "Не удалось отправить письмо, попробуй ещё раз" };
  }

  // Same answer whether or not the account exists, so the form can't be used to check emails.
  return {
    message: "Если такой аккаунт есть, мы отправили письмо со ссылкой. Открой её на этом устройстве",
  };
}

// Sets a new password for the user signed in by the reset link.
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { error: "Пароль должен быть не короче 6 символов" };
  }
  if (password !== confirm) {
    return { error: "Пароли не совпадают" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    if (error.code === "same_password") {
      return { error: "Новый пароль совпадает со старым" };
    }
    if (error.code === "weak_password") {
      return { error: "Пароль слишком простой, придумай посложнее" };
    }
    return { error: "Не удалось сменить пароль. Запроси новую ссылку" };
  }

  redirect("/");
}
