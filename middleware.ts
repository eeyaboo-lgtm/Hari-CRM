import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase session on every request, gates unauthenticated
// visitors, and enforces optional TOTP 2FA (redirects to /login/mfa when a
// signed-in session hasn't cleared the aal2 challenge yet). This is a
// convenience gate for UX only — the real authorization boundary is RLS in
// schema.sql, not this middleware.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const isMfaPath = path === "/login/mfa";

  if (!user) {
    if (!isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Signed in — check whether an enrolled TOTP factor still needs verifying
  // this session (aal1 -> aal2 step-up). Reset flows stay reachable even
  // while signed in via a recovery link.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel;

  if (needsMfa) {
    if (!isMfaPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login/mfa";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const isEntryPath = path === "/login" || path === "/signup" || isMfaPath;
  if (isEntryPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
