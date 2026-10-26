import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { OnboardingForms } from "./onboarding-forms";

// Reads the session on every request, so it renders on the server per request.
export const instant = false;

export default async function OnboardingPage() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("list_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.list_id) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Добро пожаловать</h1>
          <p className="text-sm text-zinc-400">
            Один из вас создаёт список и делится кодом приглашения, второй
            входит в него по этому коду. Вдвоём вы будете видеть один общий
            список фильмов.
          </p>
        </div>
        <OnboardingForms />
      </div>
    </main>
  );
}
