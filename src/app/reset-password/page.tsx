import Link from "next/link";
import { AuthCard } from "@/app/auth/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

// Opened from the reset email, already signed in by /auth/confirm.
export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Новый пароль"
      footer={
        <Link href="/" className="text-zinc-100 underline underline-offset-4">
          К списку
        </Link>
      }
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
