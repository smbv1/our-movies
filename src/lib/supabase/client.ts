import { createBrowserClient } from "@supabase/ssr";

// Supabase client for Client Components. It reads the session from the auth cookies,
// so Realtime subscriptions run as the signed-in user and RLS applies to them.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
