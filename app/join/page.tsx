"use client";

// Entry point for joining an EXISTING household with your own Google/email
// login, via a one-time invite code (see components/HouseholdInvites.tsx for
// where the code comes from, and the `redeem_household_invite` Postgres
// function for the server-side validation/move — 2026-08-19).
//
// Reachable two ways:
//   1. Already signed in (e.g. just finished the normal Google/email signup,
//      which auto-created a throwaway solo household) -> straight to the
//      code form below, "Join" calls the RPC directly.
//   2. Not signed in yet -> sign in with Google or create an account first;
//      both paths carry `?code=...&auto=1` through `next` so this page picks
//      the code back up and auto-submits once the session exists.
//
// Deliberately reuses the existing signup/callback machinery instead of
// touching it — GoogleSignInButton and /auth/callback already support an
// arbitrary `next` path, so `next=/join?code=X&auto=1` round-trips for free.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useHousehold } from "@/lib/HouseholdContext";

export default function JoinHouseholdPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshHousehold } = useHousehold();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState(params.get("code")?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Mini email fallback, in case Google isn't set up for whoever's joining.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setCheckingAuth(false);
    });
  }, []);

  const redeem = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (trimmed.length < 4) {
      setError("Enter the invite code you were given.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.rpc("redeem_household_invite", { p_code: trimmed });
    setBusy(false);
    if (err) {
      setError(err.message.replace(/^.*?:\s*/, ""));
      return;
    }
    setSuccess(true);
    // Local household-member cache belongs to the household this browser
    // just LEFT — same reasoning as the logout flows in ProfileGate/
    // PinSetupGate, don't let stale entries bleed into the new household.
    try {
      window.localStorage.removeItem("household.members");
      window.sessionStorage.removeItem("household.activeMemberId");
      window.sessionStorage.removeItem("household.unlocked");
    } catch {}
    await refreshHousehold();
    setTimeout(() => router.push("/dashboard"), 1200);
  };

  // Auto-submit once: signed in, a code is present in the URL, and ?auto=1
  // was set by the redirect chain (Google sign-in / email confirmation).
  useEffect(() => {
    if (checkingAuth || !signedIn) return;
    if (params.get("auto") === "1" && code && !busy && !success) {
      redeem(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, signedIn]);

  const emailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setEmailBusy(true);
    setError("");
    const supabase = createClient();
    const nextPath = `/join?code=${encodeURIComponent(code)}&auto=1`;
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // No household_name here on purpose — the new-user trigger falls
        // back to "<name>'s Household" for this throwaway starter
        // household, which redeem_household_invite() replaces (and cleans
        // up, since it'll be empty) the moment the code is redeemed.
        data: { display_name: email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    setEmailBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      setSignedIn(true);
      return; // the auto-submit effect above picks it up
    }
    setEmailSent(true);
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-base-bg" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-xl2 bg-base-panel p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-accent-blue" />
          <div className="h-3 w-3 rounded-full bg-accent-pink" />
        </div>
        <h1 className="text-xl font-semibold text-white">Join a household</h1>
        <p className="mt-1 text-sm text-gray-400">
          Enter the invite code someone shared with you to join their household with your own login.
        </p>

        {success ? (
          <div className="mt-6 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-3 text-sm text-accent-green">
            You're in! Taking you to the dashboard...
          </div>
        ) : emailSent ? (
          <div className="mt-6 rounded-lg border border-accent-blue/30 bg-accent-blue/10 px-3 py-3 text-sm text-gray-200">
            Check <span className="text-white">{email}</span> for a confirmation link — clicking it finishes joining
            automatically.
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-5">
              <label className="mb-1 block text-xs text-gray-400" htmlFor="code">
                Invite code
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7F3KQ9ZP"
                className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-center font-mono text-sm tracking-widest text-gray-100 outline-none focus:border-accent-purple"
              />
            </div>

            {signedIn ? (
              <button
                type="button"
                onClick={() => redeem(code)}
                disabled={busy}
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Joining..." : "Join household"}
              </button>
            ) : (
              <>
                <div className="mt-4">
                  <GoogleSignInButton next={`/join?code=${encodeURIComponent(code)}&auto=1`} />
                </div>
                <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
                  <div className="h-px flex-1 bg-base-border" />
                  or use email
                  <div className="h-px flex-1 bg-base-border" />
                </div>
                <form onSubmit={emailSignUp} className="space-y-3">
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
                  />
                  <button
                    type="submit"
                    disabled={emailBusy}
                    className="w-full rounded-lg border border-base-border bg-base-card py-2.5 text-sm font-medium text-gray-100 hover:border-accent-purple disabled:opacity-50"
                  >
                    {emailBusy ? "Creating account..." : "Create account & join"}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        <p className="mt-6 text-center text-xs text-gray-500">
          Starting your own household instead?{" "}
          <Link href="/signup" className="text-accent-purple">
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}
