import Link from "next/link";
import { AuthCard } from "@/app/auth/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

// Reads ?expired from the request, so it renders on the server per request.
export const instant = false;

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  const { expired } = await searchParams;

  return (
    <AuthCard
      title="Восстановление пароля"
      footer={
        <>
          Вспомнили?{" "}
          <Link href="/login" className="text-zinc-100 underline underline-offset-4">
            Войти
          </Link>
        </>
      }
    >
      {expired && (
        <p role="alert" className="text-sm text-red-400">
          Ссылка устарела или уже использована. Запроси новую.
        </p>
      )}
      <ForgotPasswordForm />
    </AuthCard>
  );
}
