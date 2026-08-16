"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setHasSession(!!user);
      setReady(true);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-bg px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-base-panel p-8">
        <h1 className="text-xl font-semibold text-white">Set a new password</h1>

        {!ready ? null : !hasSession ? (
          <>
            <p className="mt-2 text-sm text-gray-400">
              This reset link has expired or was already used.
            </p>
            <Link href="/forgot-password" className="mt-4 inline-block text-sm text-accent-purple">
              Request a new link
            </Link>
          </>
        ) : done ? (
          <p className="mt-4 text-sm text-gray-200">Password updated — taking you to the dashboard...</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-gray-400" htmlFor="password">
                New password
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
                Confirm new password
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
              {busy ? "Saving..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
