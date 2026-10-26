import Link from "next/link";
import { AuthCard } from "@/app/auth/auth-card";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthCard
      title="Регистрация"
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-zinc-100 underline underline-offset-4">
            Войти
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
