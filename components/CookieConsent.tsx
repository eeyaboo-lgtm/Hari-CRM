"use client";

// GDPR/ePrivacy-style cookie banner (pattern reused from the DinoHistory
// project). Hari-CRM has no analytics or ad cookies today — only the
// strictly-necessary auth session cookie Supabase sets to keep you signed
// in — so this is a lightweight notice-and-acknowledge banner rather than
// an "accept/reject" gate. If analytics is ever added, its script tag must
// be gated behind an "accepted" choice here, same as the DinoHistory
// pattern, not loaded unconditionally.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "hari-crm-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      // storage unavailable — skip the banner rather than error
    }
  }, []);

  const acknowledge = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, "acknowledged");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4">
      <div className="glass-card flex w-full max-w-2xl flex-col gap-3 rounded-xl2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative z-10 flex items-start gap-3">
          <Cookie size={18} className="mt-0.5 shrink-0 text-accent-orange" />
          <p className="text-xs leading-relaxed text-gray-300">
            Hari-CRM only uses a strictly-necessary cookie to keep you signed in — no analytics, no ads, no
            tracking. See our{" "}
            <Link href="/legal/privacy#cookies" className="text-accent-blue hover:underline">
              Cookie &amp; Privacy notice
            </Link>{" "}
            for details.
          </p>
        </div>
        <button
          type="button"
          onClick={acknowledge}
          className="relative z-10 shrink-0 rounded-full bg-white px-4 py-2 text-xs font-semibold text-base-bg"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
