import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing page of email links (password reset). Signs the user in from the link,
// then sends them on to `next`. Handles both link styles Supabase can send:
// `token_hash` + `type` (custom email template, works on any device) and `code`
// (default PKCE link, works only in the browser that asked for it).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // Only paths on this site, so the link can't bounce the user elsewhere.
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
