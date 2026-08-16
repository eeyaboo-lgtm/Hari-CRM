import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Handles the PKCE `code` redirect used by Google OAuth sign-in, email
// verification links, and password-reset links alike — exchanges the code
// for a real session, then hands off to `next` (middleware.ts takes it from
// there, including the MFA step-up redirect if 2FA is enrolled).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Render sits behind a proxy (Cloudflare -> Render's own edge), so
  // `request.url`'s origin resolves to the internal container address
  // (http://localhost:10000) instead of the public domain. Rebuild the real
  // public origin from the standard forwarded headers instead — this is
  // Supabase's own documented fix for exactly this class of host, and it's
  // host-agnostic (works the same if this ever moves off Render).
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const publicOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${publicOrigin}/login?error=oauth_failed`);
}
