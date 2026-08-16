"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck } from "lucide-react";

type Factor = { id: string; status: string };

export default function TwoFactorSettings() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [pendingFactorId, setPendingFactorId] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const verified = factors.find((f) => f.status === "verified");

  const startEnroll = async () => {
    setMsg("");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) {
      setMsg(error?.message ?? "Couldn't start enrollment");
      return;
    }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  };

  const cancelEnroll = async () => {
    if (pendingFactorId) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    }
    setEnrolling(false);
    setPendingFactorId("");
    setQrCode("");
    setSecret("");
    setCode("");
    setMsg("");
    load();
  };

  const confirmEnroll = async () => {
    setMsg("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setMsg("Invalid code — try again.");
      return;
    }
    setMsg("2FA enabled.");
    setEnrolling(false);
    setQrCode("");
    setSecret("");
    setCode("");
    load();
  };

  const disable = async () => {
    if (!verified) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    setMsg(error ? error.message : "2FA disabled.");
    load();
  };

  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
        <ShieldCheck size={16} className="text-accent-green" /> Security — two-factor authentication
      </h2>
      <p className="relative z-10 mb-4 text-sm text-gray-400">
        Optional. Adds a 6-digit authenticator-app code to sign-in, on top of your password. Login lockout and
        audit log are already active at the database level regardless of this setting.
      </p>

      <div className="relative z-10">
        {loading && <p className="text-xs text-gray-500">Loading...</p>}

        {!loading && !enrolling && verified && (
          <div className="space-y-2">
            <p className="text-sm text-accent-green">2FA is enabled on this account.</p>
            {msg && <p className="text-xs text-gray-400">{msg}</p>}
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="rounded-lg border border-base-border px-3 py-1.5 text-xs text-gray-300 hover:border-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Disable 2FA
            </button>
          </div>
        )}

        {!loading && !enrolling && !verified && (
          <div className="space-y-2">
            {msg && <p className="text-xs text-gray-400">{msg}</p>}
            <button
              type="button"
              onClick={startEnroll}
              disabled={busy}
              className="rounded-lg bg-accent-purple px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              Enable 2FA
            </button>
          </div>
        )}

        {enrolling && (
          <div className="max-w-xs space-y-3">
            <p className="text-sm text-gray-300">Scan with your authenticator app (Google Authenticator, Authy, etc.):</p>
            {qrCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCode} alt="2FA QR code" className="rounded-lg bg-white p-2" width={180} height={180} />
            )}
            <p className="break-all text-xs text-gray-500">Or enter manually: {secret}</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="6-digit code"
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
            {msg && <p className="text-xs text-accent-orange">{msg}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmEnroll}
                disabled={busy || code.length !== 6}
                className="rounded-lg bg-accent-purple px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={cancelEnroll}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
