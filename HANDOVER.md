# Hari-CRM — Session Handover (2026-08-15)

## Status: PUSHED & LIVE (auto-deploy) — commit `1824aa5`

Two fixes + one feature shipped this round, all build-verified and confirmed
live via browser check before moving on:

1. **Blank-screen bug fixed** (`6278b41`) — the 2026-08-14 CSP hardening set
   `script-src 'self'` with no `unsafe-inline`, which silently blocked
   Next.js App Router's inline hydration scripts. Page rendered its SSR
   shell (ProfileGate's `!ready` placeholder) and React never attached — no
   console error, all chunks 200, looked like a working deploy. Diagnostic
   method saved in memory as `feedback_csp_blank_screen` (check for a
   `__reactFiber$*` key on the root DOM node — absent means hydration never
   ran, go straight to CSP). Fix: `'unsafe-inline'` added back to
   `script-src`. TODO: swap to per-request nonce once real auth exists.
2. **Finance page rebuilt** (`d33a8d5`, part 3 of the original 6-part
   request) — see below.
3. **NaN bug fixed** (`1824aa5`) — the rebuild reused the old Finance page's
   localStorage keys (`finance.accounts`/`loans`/`subs`), which had a
   different shape (old loans had no principal/rate/tenure). Any browser
   that had visited the old page hydrated the new EMI math with `undefined`
   fields → "committed outflow: NaN". Fixed by bumping keys to `.v2`.

## Finance rebuild — what shipped (commit `d33a8d5`, patched by `1824aa5`)
- `lib/financeUtils.ts`: reducing-balance EMI formula, amortized
  remaining-balance calc, monthly-date helpers, red/orange/green/blue
  budget-status algorithm (ratio of monthly outflow to a household budget).
- Per-user split: filter tabs (Household/Shenaal/Shalini/Shared) across
  every section; every account/card/loan/subscription tagged with an owner.
- Click-to-blur/unblur on sensitive balances (salary accounts) — session-only
  reveal state, resets on reload.
- New **Cards** section: Visa/Mastercard tiles (last-4 digits only),
  expandable detail (credit limit/used/outstanding/APR), auto-calculated EMI
  when the card has a payment plan, per-card ad-hoc spend log that updates
  limit-used/outstanding live.
- **Loans**: lender type (bank/person/institution), EMI and remaining
  balance now computed from principal/rate/tenure/start-date instead of
  manually-entered numbers.
- **Subscriptions**: monthly (billing day) or yearly (fixed date) cadence,
  tax %, computed monthly-equivalent cost.
- **Upcoming payments** widget (next 14 days, merges subs + loan due dates)
  and a **next major payment** widget (yearly bills landing 2–4 months out)
  — both on the Finance page itself (not yet mirrored to the dashboard).
- Household-wide monthly budget input drives the status pill.
- Verified live in-browser post-deploy: real EMI numbers computing
  correctly (e.g. 42,000 AED @ 4.5% / 36mo → 1,249 AED/mo), upcoming/next-major
  widgets correct, zero console errors.

## NOT done in the Finance rebuild (acceptable scope cuts, revisit if asked)
- No dedicated card-detail page — detail is an inline `<details>` expander,
  not a separate route.
- Dashboard's "upcoming payments" placeholder widget not yet wired to real
  Finance data — still hardcoded (`app/dashboard/page.tsx`). That's task #7
  in PROJECT-STATUS.md (wire Supabase/real data into every page), not
  specific to this rebuild.
- University payment-timeline cycle tracker (mentioned in the original spec
  for loans) not built — current loan model handles bank/person/institution
  EMI loans well but has no special "cycle" UI for tuition-style schedules.

## Shipped this round (parts 1, 2, and part of 4 of the original 6-part request)
1. **Household/Profile/PIN system** — `lib/HouseholdContext.tsx` +
   `components/ProfileGate.tsx`, wired into `app/layout.tsx`, `TopBar.tsx`,
   `app/settings/page.tsx`. Netflix-style profile picker gates the whole app;
   optional 6-digit PIN per member (SHA-256 hashed, never plain). Settings →
   Household profiles: add/remove/rename members, set/change/remove PIN.
2. **Health page restructured** (`app/health/page.tsx`) — three sections:
   Conditions & history, Appointment history (member dropdown selector),
   Insurance details (provider, key policyholder, expiry/renewal dates,
   co-pays/allowances/coverage notes, 4 file upload slots — card front/back,
   network file, benefits table — each openable in a new tab or downloadable).
   Files are data-URLs client-side (same localStorage cap as vision board
   photos) until the `health-documents` Supabase bucket is wired up.
4. **Business page partial** (`app/business/page.tsx`) — fixed UnwindCircle
   (unwindcircle.com) + Dino History (dinohistory.com) project links,
   idea-journal input now saves every keystroke as a draft (was possibly
   losing typed-but-not-submitted text), new Program stack section
   (Render/GitHub/Supabase/Cloudflare/Spaceship.com presets + custom, masked
   email/username, clickable links).

## NOT done yet — next session, in this order
3. ~~Finance page rebuild~~ — **DONE**, see above (`d33a8d5`/`1824aa5`).
   Remaining scope cuts: university cycle tracker, dashboard widget wiring
   (folded into #7 below).
5. **Vision board additions** (not started) — trips/bucket-list/experiences
   w/ type + ticket price/links; trip detail page (one-way/round-trip/
   per-person costs, notes, shortcuts to MakeMyTrip/Expedia/Booking.com/
   Trivago/Agoda/TripAdvisor/Airbnb + 4 more); experience shortcuts by region
   (UAE: Platinumlist/Cobone/Groupon/Fever; need a quick web search next
   session for the right US and Sri Lanka equivalents).
6. **Memberships module** (not started) — new dashboard bottom-button + page,
   distinct from Subscriptions (renewal/expiry/fees/payment dates, can
   include loyalty cards).
7. Extend `schema.sql` to match all of the above once the Supabase migration
   blocker is resolved (see PROJECT-STATUS.md) — everything above is still
   localStorage-only, per-browser, not synced across devices.

## Notes for next session
- GitHub push needs a fresh token pasted into chat each session (or the
  GitHub connector authorized once in claude.ai connector settings for
  persistent access) — nothing is stored between sessions by design.
- Environment quirk this session: `/tmp/hari-crm-work` (the usual scratch dir
  name from past sessions) was stuck with a permission error unrelated to
  git. Workaround: use a fresh uniquely-named `/tmp` dir each time
  (`/tmp/hari-crm-work-$(date +%s)`) rather than reusing a fixed name.
- Working git workflow confirmed again: (1) rsync workspace → scratch dir A,
  `npm install && npm run build` there to verify; (2) separately, fresh clean
  dir B, `git init` + remote + fetch + `checkout -b main origin/main`; (3)
  rsync scratch dir A's *edited* files on top of clean dir B (this avoids the
  "untracked files would be overwritten" checkout error); (4) commit + push
  from dir B.
