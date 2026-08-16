"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    // Never branch on the result here — same message whether or not the
    // email exists, per SECURITY.md ("never leak whether an email is
    // registered").
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-bg px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-base-panel p-8">
        <h1 className="text-xl font-semibold text-white">Reset password</h1>
        <p className="mt-1 text-sm text-gray-400">
          Enter your account email and we'll send a reset link, if it's registered.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-accent-purple/30 bg-accent-purple/10 px-3 py-2 text-sm text-gray-200">
            If that email is registered, a reset link is on its way. Check your inbox.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
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
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-gray-500">
          <Link href="/login" className="text-accent-purple">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
