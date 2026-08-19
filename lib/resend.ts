// Minimal Resend (https://resend.com) client — no SDK dependency, just
// fetch, since this is the only email Hari-CRM ever sends. Free plan is
// 100 emails/day / 3,000/month, $0/mo, but DOES require verifying a domain
// you control (Resend, like every real email API, won't send arbitrary
// "from" addresses on an unverified domain) — see HANDOVER.md / BACKLOG.md
// for the exact setup steps. Until RESEND_API_KEY + ALERTS_FROM_EMAIL are
// set, every call here is a safe no-op — this file never throws for a
// missing key, it returns a clear { ok:false, error } instead, so
// deploying this code before finishing that setup doesn't break anything.

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY / ALERTS_FROM_EMAIL not configured — see HANDOVER.md for setup steps." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}
