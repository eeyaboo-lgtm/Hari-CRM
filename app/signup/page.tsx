"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function SignupPage() {
  const [householdName, setHouseholdName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!householdName.trim() || !displayName.trim()) {
      setError("Household name and your name are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { household_name: householdName.trim(), display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setBusy(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // A real (not brand-new) email returns a user with no identities on the
    // response instead of an error — Supabase's documented way to avoid
    // leaking which emails are registered.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with that email already exists. Try signing in instead.");
      return;
    }
    if (data.session) {
      // Email confirmation is off — already signed in.
      window.location.href = "/dashboard";
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-bg px-4">
        <div className="w-full max-w-sm rounded-xl2 bg-base-panel p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Check your email</h1>
          <p className="mt-2 text-sm text-gray-400">
            We sent a confirmation link to <span className="text-gray-200">{email}</span>. Click it to activate
            your household and sign in.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm text-accent-purple">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-xl2 bg-base-panel p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-accent-blue" />
          <div className="h-3 w-3 rounded-full bg-accent-pink" />
        </div>
        <h1 className="text-xl font-semibold text-white">Create your household</h1>
        <p className="mt-1 text-sm text-gray-400">Start your own Hari-CRM household dashboard.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6">
          <GoogleSignInButton next="/dashboard" />
        </div>
        <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
          <div className="h-px flex-1 bg-base-border" />
          or
          <div className="h-px flex-1 bg-base-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400" htmlFor="householdName">
              Household name
            </label>
            <input
              id="householdName"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="e.g. The Fernando Household"
              required
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400" htmlFor="displayName">
              Your name
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Creating..." : "Create household"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-purple">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
