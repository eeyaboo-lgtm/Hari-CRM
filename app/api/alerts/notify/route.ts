import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcEMI, nextMonthlyDate, daysUntil } from "@/lib/financeUtils";
import { upcomingPaymentAlerts, elevatedSubscriptionAlerts, renewalAlerts, type Alert } from "@/lib/alertsUtils";
import { sendEmail } from "@/lib/resend";

// Smart-alerts email digest — meant to be hit on a schedule by a FREE
// external cron (e.g. cron-job.org, once a day), not by anything inside
// this app itself (Next.js/Render have no built-in scheduler here). See
// HANDOVER.md "Smart alerts setup" for the exact 3 steps this needs
// (Resend account + verified domain, Render env vars, the external cron)
// — until those are done this route runs safely and just sends nothing.
//
// Only computes what's actually in Supabase: upcoming loan/subscription/
// payment-scheme-item due dates (next 3 days), currently-active elevated
// subscription overrides, and membership renewals (next 14 days).
// Budget-vs-spending-plan alerts and Health Insurance renewals are NOT
// included here — both live in browser localStorage only (by existing app
// design, not something this feature changed), so only the in-app
// AlertsBanner on the Dashboard can see them.
//
// Recomputes EMI/next-due-date from principal/rate/tenure/start-date and
// billing-day rather than trusting the DB's own next_due_date/
// monthly_installment columns, matching how the client itself always
// recomputes these rather than trusting stored derived values.

function requireSecret(req: Request): boolean {
  const configured = process.env.ALERTS_CRON_SECRET;
  if (!configured) return false; // refuse everything until a secret is actually set
  const url = new URL(req.url);
  const provided = req.headers.get("x-cron-secret") ?? url.searchParams.get("secret");
  return provided === configured;
}

function loanNextDueDate(l: { start_date: string | null }): Date {
  const day = l.start_date ? new Date(l.start_date).getDate() : 1;
  return nextMonthlyDate(day);
}

function alertsEmailHtml(householdName: string, alerts: Alert[]): string {
  const rows = alerts
    .map((a) => `<li style="margin-bottom:8px"><strong>${a.title}</strong><br/><span style="color:#666">${a.detail}</span></li>`)
    .join("");
  return `
    <div style="font-family:sans-serif;max-width:480px">
      <h2>Hari-CRM — ${householdName}</h2>
      <p>${alerts.length} thing${alerts.length === 1 ? "" : "s"} coming up:</p>
      <ul style="padding-left:18px">${rows}</ul>
      <p style="color:#999;font-size:12px">You're getting this because email alerts are turned on in Settings.</p>
    </div>
  `;
}

export async function GET(req: Request) {
  if (!requireSecret(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results: { household: string; sent: boolean; alertCount: number; error?: string }[] = [];

  const { data: households, error: hErr } = await admin
    .from("households")
    .select("id, name, owner_id")
    .eq("alerts_email_enabled", true);
  if (hErr) return NextResponse.json({ ok: false, error: hErr.message }, { status: 500 });

  for (const household of households ?? []) {
    try {
      if (!household.owner_id) {
        results.push({ household: household.name, sent: false, alertCount: 0, error: "No household head/owner set" });
        continue;
      }
      const { data: userData } = await admin.auth.admin.getUserById(household.owner_id);
      const email = userData?.user?.email;
      if (!email) {
        results.push({ household: household.name, sent: false, alertCount: 0, error: "Head has no email on file" });
        continue;
      }

      const { data: profiles } = await admin.from("profiles").select("id").eq("household_id", household.id);
      const memberIds = (profiles ?? []).map((p: any) => p.id);
      if (memberIds.length === 0) {
        results.push({ household: household.name, sent: false, alertCount: 0 });
        continue;
      }

      const [{ data: loans }, { data: subs }, { data: schemes }, { data: schemeItems }, { data: memberships }] = await Promise.all([
        admin.from("finance_loans").select("name, currency, principal, interest_rate, tenure_months, start_date").in("owner_id", memberIds),
        admin.from("finance_subscriptions").select("name, currency, amount, billing_cycle, billing_day, next_due_date, tax_pct, elevated_amount, effective_until").in("owner_id", memberIds),
        admin.from("finance_payment_schemes").select("id, name, currency").in("owner_id", memberIds),
        admin.from("finance_payment_scheme_items").select("scheme_id, label, amount, cadence, due_date, billing_day, paid").in("owner_id", memberIds),
        admin.from("memberships").select("name, renewal_date").in("owner_id", memberIds),
      ]);

      const schemeById = new Map((schemes ?? []).map((s: any) => [s.id, s]));

      const upcoming = [
        ...(subs ?? []).map((s: any) => {
          const withTax = s.amount * (1 + (s.tax_pct ?? 0) / 100);
          const date = s.billing_cycle === "monthly" ? nextMonthlyDate(s.billing_day) : new Date(s.next_due_date || Date.now());
          return { label: s.name, currency: s.currency, amount: Math.round(withTax), days: daysUntil(date) };
        }),
        ...(loans ?? []).map((l: any) => ({
          label: l.name,
          currency: l.currency,
          amount: Math.round(calcEMI(l.principal, l.interest_rate, l.tenure_months)),
          days: daysUntil(loanNextDueDate(l)),
        })),
        ...(schemeItems ?? [])
          .filter((it: any) => it.cadence === "monthly" || !it.paid)
          .map((it: any) => {
            const scheme = schemeById.get(it.scheme_id);
            const date = it.cadence === "monthly" ? nextMonthlyDate(it.billing_day) : new Date(it.due_date || Date.now());
            return { label: `${scheme?.name ?? "Payment scheme"} — ${it.label}`, currency: scheme?.currency ?? "AED", amount: it.amount, days: daysUntil(date) };
          }),
      ];

      const elevatedSubs = (subs ?? [])
        .filter((s: any) => s.elevated_amount != null)
        .map((s: any) => ({ provider: s.name, elevatedAmount: s.elevated_amount, effectiveUntil: s.effective_until ?? "", currency: s.currency }));

      const renewals = (memberships ?? [])
        .filter((m: any) => m.renewal_date)
        .map((m: any) => ({ name: m.name, date: m.renewal_date, kind: "Membership", href: "/memberships" }));

      const alerts: Alert[] = [
        ...upcomingPaymentAlerts(upcoming),
        ...elevatedSubscriptionAlerts(elevatedSubs),
        ...renewalAlerts(renewals),
      ];

      if (alerts.length === 0) {
        results.push({ household: household.name, sent: false, alertCount: 0 });
        continue;
      }

      const sendResult = await sendEmail({
        to: email,
        subject: `Hari-CRM: ${alerts.length} thing${alerts.length === 1 ? "" : "s"} coming up`,
        html: alertsEmailHtml(household.name, alerts),
      });
      results.push({ household: household.name, sent: sendResult.ok, alertCount: alerts.length, error: sendResult.ok ? undefined : sendResult.error });
    } catch (err) {
      results.push({ household: household.name, sent: false, alertCount: 0, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
