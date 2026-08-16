"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Full-screen step-up gate shown after a correct password when the account
// has TOTP 2FA enrolled. Always keep a logout escape hatch on gates like
// this — a prior full-screen gate (PinSetupGate) shipped without one and
// locked users out with no way back to the login screen.
export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      setFactorId(totp?.id ?? null);
      setLoading(false);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError("");
    setBusy(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("Invalid code — try again.");
      return;
    }
    window.location.href = "/dashboard";
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-bg px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-base-panel p-8">
        <h1 className="text-xl font-semibold text-white">Two-factor verification</h1>
        <p className="mt-1 text-sm text-gray-400">Enter the 6-digit code from your authenticator app.</p>

        {!loading && !factorId && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            No verified authenticator found for this account.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            autoFocus
            className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-center text-lg tracking-[0.3em] text-gray-100 outline-none focus:border-accent-purple"
          />
          <button
            type="submit"
            disabled={busy || !factorId}
            className="w-full rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Verifying..." : "Verify"}
          </button>
        </form>

        <button type="button" onClick={logout} className="mt-4 text-xs text-gray-500 hover:text-white">
          Log out
        </button>
      </div>
    </div>
  );
}
