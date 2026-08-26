"use client";

// Internal strategy memo — admin-only. Purpose is motivation and institutional
// memory: why we're building this, what it would take to become a real
// public app-store product, and the real numbers behind similar companies
// (not vibes). Gated the same way Settings gates its admin-only sections:
// useHousehold().isAdmin, redirect non-admins to /dashboard.
//
// Content mirrors the memo delivered 2026-08-26 (see LifeOS-Billion-Dollar-
// Strategy.md for the full competitive research) plus fresh app-store
// economics and a competitor "who got rich and how" dossier. First pass —
// functional over polished, per Coco's request to rush a viewable version.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useHousehold } from "@/lib/HouseholdContext";
import {
  Rocket,
  TrendingUp,
  Target,
  DollarSign,
  Smartphone,
  ShieldCheck,
  Clock,
  Building2,
  CheckCircle2,
  Circle,
} from "lucide-react";

type Score = { label: string; verdict: string; tone: "good" | "warn" | "risk"; note: string };

const SCORECARD: Score[] = [
  {
    label: "Market",
    verdict: "Real, not huge",
    tone: "warn",
    note: "A genuine niche with proven willingness to pay — not a blue-ocean billion-dollar TAM. Adjacent household-services market: $5.26B (2026) to $7.79B (2030).",
  },
  {
    label: "Our moat",
    verdict: "One real edge",
    tone: "warn",
    note: "The Vision/goals layer is genuinely unmatched. Everything else (calendar, finance, health vault) is table-stakes competitors already ship.",
  },
  {
    label: "Product readiness",
    verdict: "Not store-ready",
    tone: "risk",
    note: "Hand-seeded SQL accounts, one audited household, no billing, no native shell yet. This is pre-seed, not pre-launch.",
  },
  {
    label: "Fundability today",
    verdict: "Not yet",
    tone: "risk",
    note: "Zero external users, zero retention data, zero paid conversion. That evidence is the actual next milestone — see the roadmap below.",
  },
];

const TONE_CLASSES: Record<Score["tone"], string> = {
  good: "bg-accent-green/15 text-accent-green border-accent-green/30",
  warn: "bg-accent-orange/15 text-accent-orange border-accent-orange/30",
  risk: "bg-red-500/15 text-red-400 border-red-500/30",
};

type Competitor = {
  name: string;
  founded: string;
  founders: string;
  stack: string;
  pricing: string;
  funding: string;
  outcome: string;
  lesson: string;
};

const COMPETITORS: Competitor[] = [
  {
    name: "Cozi",
    founded: "2005, Seattle",
    founders: "Robbie Cape & Jan Miksovsky (ex-Microsoft)",
    stack: "iOS, Android, web, Windows app (family calendar, lists, meal planning)",
    pricing: "Free with limits + Cozi Gold ad-free/extra features subscription",
    funding: "Bootstrapped/early VC, then a trade sale — never disclosed a big venture round publicly",
    outcome: "Sold to Time Inc. (2014, price undisclosed) -> Meredith (2018) -> OurFamilyWizard (May 2022, price undisclosed). 20M+ registered users at last sale.",
    lesson: "You can build a real 20M-user product and still exit for an undisclosed, unspectacular price. Reach alone doesn't make anyone rich — depth and pricing power do.",
  },
  {
    name: "FamilyWall",
    founded: "Ireland (founding year/founder not clearly public)",
    founders: "Not clearly published — stayed a small, independent team",
    stack: "iOS, Android, web — calendar, chores, light finance, messaging, photos",
    pricing: "Freemium, modest premium tier",
    funding: "No large disclosed venture round found — appears largely self-funded",
    outcome: "5M+ installs, 4.8 star average. No known exit or IPO.",
    lesson: "Proof you can carve a loyal niche and genuinely delight users (best-reviewed UI in the category) without ever raising big money. Also proof that alone doesn't make you rich either.",
  },
  {
    name: "Life360",
    founded: "2008, San Mateo, CA",
    founders: "Chris Hulls & Alex Haro",
    stack: "iOS, Android — GPS location sharing, crash detection, driving reports",
    pricing: "Freemium; paid tiers roughly $8-40/mo for family plans with emergency dispatch",
    funding: "~$90M raised pre-IPO (Seed $275K Google grant, Series A $5.5M, B $10-17M, C $50M). IPO'd on the ASX in May 2019, raising AU$145.4M. Acquired Tile (Bluetooth trackers) for $205M in 2021.",
    outcome: "Publicly traded. FY2025 revenue $489.5M on 95.8M Q4 monthly active users. Co-founder Chris Hulls' current disclosed stake is worth roughly $47M (Aug 2026) after years of share sales.",
    lesson: "The one hard proof a family app can reach real public-company scale — but it took ~17 years, one narrow and emotionally urgent job (child safety), and a naturally viral invite loop. Broader products have a harder version of this problem.",
  },
  {
    name: "Quicken / Simplifi",
    founded: "Quicken: 1983 (Intuit). Simplifi: newer subscription-only product line.",
    founders: "Originally Intuit (Scott Cook); now independently owned",
    stack: "Web + iOS/Android — budgeting, spending plan, projected cash flow",
    pricing: "Simplifi roughly $4-7/mo depending on plan/promo",
    funding: "Not VC-backed in its current form — sold by Intuit to H.I.G. Capital (private equity) in 2016, terms undisclosed, then H.I.G. sold it again to Aquiline Capital Partners in 2021, also undisclosed.",
    outcome: "A 40+ year old product that has survived two private-equity ownership changes. Never a venture home run for anyone currently involved.",
    lesson: "Durable category, real revenue, but this is the 'boring survivor' path, not the 'founder gets rich' path — the money here is in owning cash-flowing software, not in a dramatic exit.",
  },
  {
    name: "Monarch Money",
    founded: "2018",
    founders: "Val Agostino (ex-Mint product lead), Ozzie Osman, Jon Sutherland",
    stack: "Web + iOS/Android — bank-aggregated budgeting, family collaboration",
    pricing: "$14.99/mo or $99.99/yr",
    funding: "$75M Series B in May 2025 at an $850M valuation (Forerunner Ventures, FPV Ventures), riding demand after Intuit shut down Mint.",
    outcome: "Still private; $850M paper valuation as of its most recent round. No exit yet.",
    lesson: "The most direct comp to our own Finance module going it alone — real proof VCs still write big checks for a well-executed budgeting app when the timing is right (a competitor shutting down, in this case).",
  },
  {
    name: "Rocket Money (fka Truebill)",
    founded: "2016, Silver Spring, MD",
    founders: "Haroon, Idris & Yahya Mokhtarzada (three brothers)",
    stack: "iOS, Android, web — subscription cancellation, bill negotiation, net worth, credit monitoring",
    pricing: "Freemium; $3-12/mo depending on tier, plus a cut of negotiated bill savings",
    funding: "Raised at least a $45M Series D (2021) before its exit.",
    outcome: "Acquired by Rocket Companies (the mortgage/fintech giant) in December 2021 for $1.275 BILLION — roughly 5 years founding-to-exit.",
    lesson: "The single biggest payday in this list, and the fastest. Won with one narrow, sharp wedge (cancel your subscriptions) that expanded into a fuller finance app, then sold to a strategic buyer who wanted the cross-sell into mortgages.",
  },
];

type Phase = {
  window: string;
  title: string;
  goal: string;
  items: string[];
  cost: string;
};

const PHASES: Phase[] = [
  {
    window: "Now - 3 months",
    title: "Phase 0: Make it safe to hand to a stranger",
    goal: "The gate before anything else matters",
    items: [
      "Self-serve signup flow (replace hand-seeded SQL accounts)",
      "Formal security audit of household-isolation RLS policies",
      "PWA polish (installable, offline-tolerant) as the cheap mobile-feel win",
      "Keep shipping the existing backlog (polish items a second household would notice first)",
    ],
    cost: "$0-500 total. Mostly sweat equity. Supabase Pro (~$25/mo) and a paid Render tier (~$7-25/mo) if not already on them. Optional: a freelance security review, $1,500-3,000 one-time.",
  },
  {
    window: "3-6 months",
    title: "Phase 1: Prove it works for people who aren't us",
    goal: "Get 10-20 real outside households using it for 60+ days",
    items: [
      "Recruit a real beta list — friends, extended family, a small waitlist",
      "Add lightweight analytics to actually measure retention, not guess (Plausible/PostHog)",
      "Track whether the invite loop works — does one household member actually pull the rest in?",
      "Fix whatever a second household immediately trips over",
    ],
    cost: "$50-150/mo infra + analytics. No paid acquisition yet — this phase is about data, not growth.",
  },
  {
    window: "6-12 months",
    title: "Phase 2: Become an actual app-store app",
    goal: "Native-feeling shell + real store listings",
    items: [
      "Capacitor wrap of the existing Next.js app (bridge, not a rewrite)",
      "Push notifications, offline handling, StoreKit/Play Billing subscription plumbing",
      "Apple Developer Program enrollment + Google Play Console account",
      "App icons, screenshots, store listing copy, privacy nutrition labels",
    ],
    cost: "$99/yr (Apple) + $25 one-time (Google). $0 if self/AI-built; $3,000-15,000 if any of the native polish or push-notification work is outsourced.",
  },
  {
    window: "12-18 months",
    title: "Phase 3: Public launch with a real price tag",
    goal: "Freemium live on both stores, first paying strangers",
    items: [
      "Free tier: one household, core calendar/lists (the Cozi/FamilyWall proven wedge)",
      "Paid tier: $6.99-8.99/mo or $59-79/yr for Finance depth, document vault, multi-household, Vision boards",
      "Small paid-acquisition test budget to sanity-check CAC against real conversion",
      "Basic customer support process (a shared inbox is enough at this stage)",
    ],
    cost: "$500-2,000/mo test ad budget (optional, only after retention data justifies it). RevenueCat or native billing (free up to a revenue threshold, then a small % cut).",
  },
  {
    window: "18-24+ months",
    title: "Phase 4: Decide how big this gets",
    goal: "Only after Phase 3 shows real numbers",
    items: [
      "If retention + conversion justify it: raise a small pre-seed/seed ($150K-500K range) or keep bootstrapping",
      "Consider real bank-aggregation (Plaid-style) only once there's volume to negotiate per-user cost down",
      "Add the document vault (Quicken LifeHub's best idea) once the security bar supports it",
      "Explicitly do NOT build location/safety (Life360's whole business) or investment-grade finance tooling (Monarch's rabbit hole) — integrate, don't compete head-on",
    ],
    cost: "Highly variable — this is the point where real money either comes in (funding) or gets reinvested (bootstrapped growth).",
  },
];

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    tagline: "The proven wedge — get people in the door",
    includes: ["One household", "Shared calendar & lists", "Basic health & fitness tracking", "Business quick-launch tiles"],
  },
  {
    name: "LifeOS Plus",
    price: "$6.99-8.99/mo (~$59-79/yr)",
    tagline: "Cheaper than Monarch alone, replaces 2-3 apps at once",
    includes: ["Everything in Free", "Full Finance depth (Spending Plan-style smart budgeting)", "Document vault (insurance, estate docs)", "Multiple households / Vision boards", "Priority support"],
  },
];

const ROI_SCENARIOS = [
  { subs: "1,000", label: "Early beta-to-paid", gross: "~$84,000/yr", netOfStoreCut: "~$63,000-71,000/yr" },
  { subs: "10,000", label: "Modest niche success", gross: "~$840,000/yr", netOfStoreCut: "~$630,000-714,000/yr" },
  { subs: "100,000", label: "Real category player (FamilyWall-scale installs, strong conversion)", gross: "~$8.4M/yr", netOfStoreCut: "~$6.3M-7.1M/yr" },
];

const APPLE_CHECKLIST = [
  "Apple Developer Program enrollment ($99/yr)",
  "A Mac + Xcode to build and sign the app (or a cloud Mac build service)",
  "App Store Connect listing: screenshots, description, keywords",
  "Privacy Nutrition Label — required disclosure of exactly what health/finance data is collected",
  "\"Sign in with Apple\" option required if Google/email sign-in is offered",
  "Subscriptions must run through StoreKit, not an external payment link, for most regions",
  "TestFlight beta review before public release",
  "App Review scrutiny is real for anything touching health data — budget review time, don't assume day-one approval",
];

const GOOGLE_CHECKLIST = [
  "Google Play Console account ($25 one-time)",
  "Data Safety form — what data is collected, shared, and why",
  "Target API level compliance (Play enforces a rolling minimum each year)",
  "Play Billing integration for subscriptions",
  "Sensitive-permission justification for health-adjacent data",
  "Closed testing track with real testers before a new developer account can go to full production",
  "Store listing: screenshots, short/long description, content rating questionnaire",
];

function ScoreTile({ s }: { s: Score }) {
  return (
    <div className="glass-card rounded-xl2 p-4">
      <p className="relative z-10 text-[11px] uppercase tracking-wide text-gray-500">{s.label}</p>
      <span
        className={`relative z-10 mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[s.tone]}`}
      >
        {s.verdict}
      </span>
      <p className="relative z-10 mt-2 text-xs leading-relaxed text-gray-400">{s.note}</p>
    </div>
  );
}

function CompetitorCard({ c }: { c: Competitor }) {
  return (
    <div className="glass-card space-y-2 rounded-xl2 p-4">
      <div className="flex items-center gap-2">
        <Building2 size={16} className="text-accent-purple" />
        <h3 className="relative z-10 font-medium text-white">{c.name}</h3>
      </div>
      <p className="relative z-10 text-xs text-gray-500">{c.founded} &middot; {c.founders}</p>
      <p className="relative z-10 text-xs text-gray-400"><span className="text-gray-500">Stack: </span>{c.stack}</p>
      <p className="relative z-10 text-xs text-gray-400"><span className="text-gray-500">Pricing: </span>{c.pricing}</p>
      <p className="relative z-10 text-xs text-gray-400"><span className="text-gray-500">Funding: </span>{c.funding}</p>
      <p className="relative z-10 text-xs font-medium text-accent-green">{c.outcome}</p>
      <p className="relative z-10 border-t border-white/5 pt-2 text-xs italic text-gray-400">{c.lesson}</p>
    </div>
  );
}

function PhaseRow({ p, index }: { p: Phase; index: number }) {
  return (
    <div className="glass-card rounded-xl2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-xs font-semibold text-accent-purple">
            {index + 1}
          </span>
          <h3 className="relative z-10 font-medium text-white">{p.title}</h3>
        </div>
        <span className="relative z-10 flex items-center gap-1 text-xs text-gray-500">
          <Clock size={12} /> {p.window}
        </span>
      </div>
      <p className="relative z-10 mt-1 text-xs text-gray-500">{p.goal}</p>
      <ul className="relative z-10 mt-3 space-y-1.5">
        {p.items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-xs text-gray-400">
            <Circle size={6} className="mt-1 shrink-0 fill-accent-blue text-accent-blue" />
            {it}
          </li>
        ))}
      </ul>
      <p className="relative z-10 mt-3 flex items-start gap-1.5 text-xs font-medium text-accent-orange">
        <DollarSign size={13} className="mt-0.5 shrink-0" /> {p.cost}
      </p>
    </div>
  );
}

export default function StrategyPage() {
  const { isAdmin, ready } = useHousehold();
  const router = useRouter();

  useEffect(() => {
    if (ready && !isAdmin) router.replace("/dashboard");
  }, [ready, isAdmin, router]);

  if (!ready || !isAdmin) {
    return <div className="min-h-screen bg-base-bg" />;
  }

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-8 p-6">
        <div>
          <div className="flex items-center gap-2">
            <Rocket size={20} className="text-accent-purple" />
            <h1 className="text-2xl font-semibold text-white">Strategy Memo</h1>
            <span className="rounded-full border border-accent-orange/30 bg-accent-orange/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-orange">
              Admin only
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">
            Why we&rsquo;re building this, the real numbers behind similar companies, and the honest, no-BS
            plan to find out if LifeOS has a real shot as a public app-store product. First pass — expect
            this to get more polished over time.
          </p>
        </div>

        <section>
          <h2 className="relative z-10 mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gray-500">
            <Target size={14} /> The honest scorecard
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SCORECARD.map((s) => (
              <ScoreTile key={s.label} s={s} />
            ))}
          </div>
        </section>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-2 flex items-center gap-2 font-medium text-white">
            <TrendingUp size={16} className="text-accent-purple" /> Why we&rsquo;re doing this
          </h2>
          <p className="relative z-10 text-sm leading-relaxed text-gray-400">
            Every competitor below picked one or two verticals (schedule, or money, or location, or docs)
            and stopped. Nobody combines scheduling, deep finance, health/insurance, a document vault, and a
            personal goals layer in one coherent product for a whole household. That&rsquo;s already what
            this app is, built for a real family before it was built for a pitch deck &mdash; the same
            playbook Basecamp and Notion used. The market isn&rsquo;t a guaranteed billion-dollar category,
            and it&rsquo;s not investor-ready yet. But it&rsquo;s a real, credible niche subscription
            business if the next few phases actually happen instead of staying an idea.
          </p>
        </section>

        <section>
          <h2 className="relative z-10 mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gray-500">
            <Building2 size={14} /> Who&rsquo;s done this before &mdash; and how rich they got
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {COMPETITORS.map((c) => (
              <CompetitorCard key={c.name} c={c} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="relative z-10 mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gray-500">
            <Clock size={14} /> Execution roadmap &amp; estimated costs
          </h2>
          <div className="space-y-3">
            {PHASES.map((p, i) => (
              <PhaseRow key={p.title} p={p} index={i} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-3 flex items-center gap-2 font-medium text-white">
              <DollarSign size={16} className="text-accent-green" /> Suggested pricing
            </h2>
            <div className="space-y-3">
              {PRICING_TIERS.map((t) => (
                <div key={t.name} className="rounded-xl2 border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <p className="relative z-10 font-medium text-white">{t.name}</p>
                    <p className="relative z-10 font-semibold text-accent-green">{t.price}</p>
                  </div>
                  <p className="relative z-10 mt-1 text-xs text-gray-500">{t.tagline}</p>
                  <ul className="relative z-10 mt-2 space-y-1">
                    {t.includes.map((i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                        <CheckCircle2 size={12} className="text-accent-green" /> {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-3 flex items-center gap-2 font-medium text-white">
              <TrendingUp size={16} className="text-accent-blue" /> Illustrative ROI (not a forecast)
            </h2>
            <p className="relative z-10 mb-3 text-xs text-gray-500">
              Rough math at the $6.99-8.99/mo tier. Real conversion depends entirely on whether Phase 1-3
              actually produce good retention &mdash; industry D30 retention runs just 3-7% on average, so
              these numbers assume this product does meaningfully better than average, not that it
              automatically will.
            </p>
            <div className="space-y-2">
              {ROI_SCENARIOS.map((r) => (
                <div key={r.subs} className="flex items-center justify-between rounded-xl2 border border-white/5 bg-white/[0.02] p-3 text-xs">
                  <div>
                    <p className="relative z-10 font-medium text-white">{r.subs} paying subs</p>
                    <p className="relative z-10 text-gray-500">{r.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="relative z-10 text-gray-300">{r.gross} gross</p>
                    <p className="relative z-10 text-accent-green">{r.netOfStoreCut} net of store cut</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-3 flex items-center gap-2 font-medium text-white">
              <Smartphone size={16} className="text-gray-300" /> Apple App Store checklist
            </h2>
            <ul className="space-y-1.5">
              {APPLE_CHECKLIST.map((i) => (
                <li key={i} className="relative z-10 flex items-start gap-2 text-xs text-gray-400">
                  <Circle size={6} className="mt-1 shrink-0 fill-gray-500 text-gray-500" /> {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card rounded-xl2 p-5">
            <h2 className="relative z-10 mb-3 flex items-center gap-2 font-medium text-white">
              <Smartphone size={16} className="text-accent-green" /> Google Play checklist
            </h2>
            <ul className="space-y-1.5">
              {GOOGLE_CHECKLIST.map((i) => (
                <li key={i} className="relative z-10 flex items-start gap-2 text-xs text-gray-400">
                  <Circle size={6} className="mt-1 shrink-0 fill-gray-500 text-gray-500" /> {i}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="glass-card rounded-xl2 border border-accent-purple/30 p-5">
          <h2 className="relative z-10 mb-2 flex items-center gap-2 font-medium text-white">
            <ShieldCheck size={16} className="text-accent-purple" /> The gate before any of this is real
          </h2>
          <p className="relative z-10 text-sm leading-relaxed text-gray-400">
            Self-serve signup, a real security audit, 10-20 outside households with 60+ days of retention
            data, proof the invite loop pulls people in, and a few people voluntarily paying &mdash; that&rsquo;s
            the actual next milestone, not &ldquo;get on the app stores.&rdquo; It&rsquo;s the same evidence a
            store listing needs anyway, and it&rsquo;s what turns this from a good idea with good research
            behind it into something a boardroom or an investor can underwrite.
          </p>
          <p className="relative z-10 mt-3 text-xs text-gray-600">
            Full sourced memo: LifeOS-Billion-Dollar-Strategy.md (repo root) &middot; last updated 2026-08-26
          </p>
        </section>
      </main>
    </div>
  );
}
