import Link from "next/link";
import { AuthCard } from "@/app/auth/auth-card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthCard
      title="Вход"
      footer={
        <>
          Нет аккаунта?{" "}
          <Link href="/signup" className="text-zinc-100 underline underline-offset-4">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
