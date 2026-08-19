# Hari-CRM Build Roadmap Queue
**Read this at the start of every session — Claude should remind you where we are in this list.** Check items off as they ship; add new ones as they come up. Full context/rationale for each item lives in `LifeOS-Billion-Dollar-Strategy.md`.

## Phase 0 — Existing polish backlog (pre-dates the strategy session)
- [x] Quick Launch customization (pick/add/remove shortcuts via Settings, optional Business-project prefill) — `lib/quickLaunch.ts`. Shipped 2026-08-17, commit `cc34cc9`, live.
- [ ] Consolidated "Upcoming" widget (Renewals + Appointments + Payments + Reminders merged into one)
- [x] Business page: editable project cards (add/edit/remove) — wired to the existing `business_projects` table. Shipped 2026-08-17, commit `46bd5ae`, live.

## Phase 1 — Make it safe/possible for anyone but us to use it
- [x] **Real signup flow** replacing hand-seeded SQL accounts — `/signup` page (client-side `supabase.auth.signUp()`) + a `handle_new_user_household()` Postgres trigger on `auth.users` insert that atomically creates the `households` + `profiles` rows. Shipped 2026-08-16.
- [x] **Google sign-in** (app code done — `GoogleSignInButton` + `/auth/callback` PKCE exchange route) — **still needs the Google Cloud Console OAuth Client ID/Secret pasted into Supabase Dashboard → Authentication → Providers → Google before it actually works.** See `GOOGLE-OAUTH-SETUP.md`.
- [ ] **Apple sign-in** — deferred until an App Store submission is actually planned; requires $99/yr Apple Developer Program regardless of web or app, so bundle that cost with the App Store decision, not before
- [x] **Optional 2FA** (TOTP/authenticator app) — enroll/verify/disable UI in Settings (`TwoFactorSettings.tsx`), `/login/mfa` step-up challenge gate enforced in `middleware.ts` via `getAuthenticatorAssuranceLevel()`. Shipped 2026-08-16.
- [x] **Password reset by email** — `/forgot-password` + `/reset-password`, native Supabase Auth. Shipped 2026-08-16. **Email verification on signup still needs "Confirm email" verified ON in Supabase Dashboard → Authentication → Providers → Email** (no MCP tool exposes this toggle to check/set it programmatically).
- [ ] **RLS penetration audit** (see method below) — still queued, deprioritized below signup/Google login since no bank data is stored and admin has oversight regardless; still matters for cross-family-member privacy (health/vision notes), not just money
- [ ] Retire the shared-login pattern (Natasha & Arun) in favor of per-person accounts once real signup exists — shared logins don't scale past our own household

## Phase 2 — Differentiate (steal the good, skip the bad, per competitor research)
- [x] **Cozi-style shared calendar** — `app/calendar/page.tsx`, real `calendar_events` table (shared/mirrored_edit, any household member can add/edit/remove), payments-per-date pulled from Finance's existing bill data, Google Calendar sync shown locked/pending-verification. Shipped 2026-08-19, `HANDOVER.md` #21. Still open from the original Cozi wishlist: meal planning → shopping list, real-time multi-device sync (no live-refresh yet, just re-fetch), unified activity feed.
- [ ] Calendar: recurring bills currently show only their *next* occurrence, not repeated across every future month you scroll to (`lib/calendarPayments.ts`) — fine for "what's due soon", not a full projection.
- [x] **Legal pages** — Privacy Policy / Terms of Use / About / Instructions for Use (`app/legal/*`) + GDPR-style cookie notice (`components/CookieConsent.tsx`), linked from `/login` and Settings. Content written fresh for Hari-CRM's real data model (health/finance/household invites/admin backup access), not lawyer-reviewed. Shipped 2026-08-19, `HANDOVER.md` #21.
- [ ] **Wearable health sync** (Samsung Health / Apple Health / Health Connect) — no free direct-to-browser path; needs either a native/PWA companion app (free) or a paid aggregator like Terra API/Spike API (per-user monthly fee). Not started — user asked 2026-08-19, see `HANDOVER.md` #21.
- [ ] **Configurable dashboard widgets** (swap in a stock-ticker card via Yahoo Finance's free-but-unofficial JSON endpoints, alongside spending trend / "where attention is going") — real redesign of the Dashboard's fixed layout, not a quick add. User asked 2026-08-19, see `HANDOVER.md` #21.
- [x] Finance **Standard/Deep view toggle** + 12-month Projected Cash Flow chart, spend-category donut, budget gauge, currency bars — shipped 2026-08-17, commit `76ec81c`, live.
- [x] **Spending Plan**: real-time safe-to-spend (income − committed outflow, live, red when negative), real recurring-income concept on `finance_income`. Shipped 2026-08-17, commit `8bbb258`, live — see `HANDOVER.md` #19.
- [ ] Pinnable Watchlists
- [x] **Unified "Add expense" flow** (monthly recurring / fixed-term / one-off in one place, incl. pure one-off costs) — new `finance_expenses` table. Shipped 2026-08-17, commit `8bbb258`.
- [x] **Estimated-figure entry**: `estimateFromRange()` in `lib/financeUtils.ts`, min–max → midpoint rounded to nearest 5. Shipped 2026-08-17, commit `8bbb258`.
- [x] `notes` column on `finance_subscriptions` + temporary-override support (`elevated_amount`/`effective_until`, auto-reverts). Shipped 2026-08-17, commit `8bbb258`. **Real values for Tabby's spike / ENBD's extra interest still need to be entered via the UI** — columns exist, not backfilled.
- [x] Real currency conversion — `fx_rates` seeded with live AED/LKR/USD rates, `convertAmount()`/`useFxRates.ts`. Feeds the Spending Plan; existing face-value sums kept as-is per the ask. Shipped 2026-08-17, commit `8bbb258`.
- [ ] Move ENBD Credit Card into `finance_cards` once real limit/outstanding are known — still blocked on user data, asked twice now (`HANDOVER.md` #18/#19 item 6)
- [x] Consistent color coding — `COLORS`/`STATUS_HEX` hoisted into `lib/financeUtils.ts` as single source of truth, all new UI reuses `accent.*`/`BUDGET_STATUS_CLASSES`. Shipped 2026-08-17, commit `8bbb258`.
- [ ] **Rocket Money-style cheap wins**: smart alerts (approaching budget limit, large purchase detected), simple net-worth rollup
- [ ] **FamilyWall UI lesson applied**: audit every module against "would the least tech-confident family member get this instantly" — not a single feature, a design pass
- [ ] **Document vault** (LifeHub-style: emergency contacts, insurance, estate docs, caregiver-shareable) — only after Phase 1's security audit is done

## Phase 3 — Business model (once Phase 1 + 2 are real)
- [ ] Freemium tier split decided (core calendar/lists free, Finance depth + vault + multi-household behind ~$6–9/mo)
- [ ] Billing integration (Stripe or similar)
- [ ] Positioning/landing page: "replaces 3 apps," not "another calendar app"

## Explicitly NOT queued (decided against, don't re-propose without new info)
- Life360-style crash detection / driving safety — liability-heavy, integrate later via API if ever, don't build
- Rocket Money-style bill-negotiation concierge — real ops staff, not software
- Monarch-style live bank aggregation (Plaid/Finicity/MX) — ~$0.60–0.90/active user/month, only makes sense at real volume with negotiated rates

---

## How to do the RLS penetration audit
Goal: prove — not assume — that no query, with any real JWT, can ever return or modify a row belonging to a different household (or a different person's private data within a household).

1. **Automated lint pass first (cheap, already available):** run Supabase's `get_advisors` (security) after any schema change — catches missing/disabled RLS outright, but won't catch logic bugs in policies that exist but are wrong.
2. **Real JWT cross-household test matrix (the actual audit):** for every one of the ~20 content tables, using two real test households' actual JWTs (not service_role, not assumptions):
   - As Household A's user, attempt SELECT/INSERT/UPDATE/DELETE on Household B's known row IDs — every single one must return zero rows / permission denied.
   - As a household member, attempt to read another member's `visibility='private'` rows — must fail.
   - Confirm the `is_admin()` bypass only works for the actual admin account, and only for the household currently selected via the switcher — not silently global.
   - Test with an anon (unauthenticated) key alone — should get nothing from any content table.
3. **Edge cases that are easy to miss:** a user who just switched households in one browser tab (session/token staleness — this is the exact bug class fixed in sessions #9/#10); a row with a null or malformed `owner_id`; a deleted/deactivated household's leftover rows.
4. **Turn it into a repeatable script**, not a one-time manual pass — a small set of REST calls run against test JWTs, so it reruns automatically after every future schema or policy change instead of trusting memory that "it was fine last time."
5. **Before any real strangers' money/data is at stake**, get a real third-party security review — the above is a strong DIY first pass, but paying for an actual outside pentest is the honest final gate before public launch, not a nice-to-have.

## How to replace hand-seeded SQL signup with a proper flow
Right now every household is created by Claude running raw SQL inserts into `auth.users`/`auth.identities`/`profiles` — fine for 4 hand-picked households, not something that scales or that a stranger should ever need someone running SQL for.

1. Build a real `/signup` page: household name + primary user's email + password, calling Supabase's own client-side `supabase.auth.signUp()` — this is safe to expose publicly (no service_role key involved), unlike the current workaround.
2. Add a Postgres trigger on `auth.users` insert that automatically creates the matching `profiles` row and a new `households` row — keeps account + profile + household creation atomic and impossible to get out of sync, instead of separate app-code steps that could partially fail.
3. Require email verification (Supabase supports this natively) before a household is fully "active" — cheap spam/throwaway-account filter.
4. Add an **invite flow** for adding a second person to an existing household: primary user sends an invite (token-based, not guessable), invited person signs up normally but the invite token attaches them to the existing `household_id` instead of creating a new one.
5. Once this exists end-to-end, retire the SQL-seeding workaround entirely — no more manual `auth.users`/`auth.identities` inserts, by Claude or anyone.
