# Hari-CRM — Session Handover (2026-08-19, latest #22 — READ THIS FIRST)

## #22 — Favicon shipped + full UI/feature suggestions doc (no code features built, review session)

**Confirmed #21's work is live**: `e52133f` ("Policies and Terms, Legal and Cookies") is on
`origin/main` — the user committed/pushed last session's local delivery themselves. Re-tested
`git push` from this sandbox with a fresh PAT the user pasted mid-session: still 403s from the
sandbox's git proxy ("not in this session's authorized repository set"), now confirmed across two
separate sessions — stop re-testing this per-session, go straight to the local-delivery fallback
(see `feedback_git_push_proxy_block` in Claude's memory).

**Favicon**: new browser-tab icon built from the app's own existing brand mark — the blue
rounded-square / pink circle / orange triangle glyph already used in `Sidebar.tsx` and the
login/signup/join pages — not a new logo. Source at `public/brand-mark.svg`, rendered via
`rsvg-convert` into Next.js's App Router icon convention: `app/favicon.ico`, `app/icon.png`,
`app/apple-icon.png`. Build-verified 0 errors, 26 routes, favicon confirmed present in
`.next/server/app/`. Delivered to this folder — needs a commit+push via GitHub Desktop like any
other session's output.

**Suggestions doc**: `HARI-CRM-SUGGESTIONS-2026-08-19.md` in this folder — a full review of the
current UI/features against what's still missing, written after studying every module's actual
code (not just BACKLOG.md). Covers: 3 necessary changes (Health has no fitness/activity tracking
at all — biggest single gap; Dashboard's "Quick add" button is still a dead placeholder since
session #6; the admin JSON backup has no restore path), 4 more suggestions (global search/Cmd+K,
smart push/email alerts built on Finance's already-computed budget data, receipts/documents
attachable to any record not just Insurance, shareable read-only snapshot links), a fitness
section modeled on what disciplined athletes track (calorie/macro counter, diet/intolerance
profile extending the existing Allergy history, recipe library + meal-prep → shopping list,
supplement/medication tracker — currently a total gap, workout log, sleep/RHR/hydration/weight —
all loggable by hand, no wearable required), 3 highest-conviction new ideas (a "Today" one-screen
briefing across all modules as the retention hook; medication/supplement adherence reminders;
proactive renewal/bill safety-net alerts), and 5 free integrations verified this session (Open
Food Facts API, Spoonacular's free 50-requests/day tier, Frankfurter.app for auto-refreshing
`fx_rates` instead of hand-seeding, Open-Meteo for a free weather widget, Google Calendar sync —
already scaffolded, just needs OAuth verification). **Nothing in that doc is built yet** — it's a
menu for the user to pick from, not something already queued. If they pick items, add them to
`BACKLOG.md` before starting any of them.

---

## #21 — Real Calendar built + legal pages (Privacy/Terms/About/Instructions) + cookie banner

**What shipped:**

1. **Calendar, for real** (`app/calendar/page.tsx`) — replaces the approved static design preview
   (`/tmp/calendar_preview.html` from the design-review pass) with actual Supabase-backed code.
   New table `calendar_events` (migration `calendar_events`, applied live) — same 4-column pattern
   as every other content table (`owner_id`, `visibility`, `install_household_rls`), always saved
   with `ownerLocalId: () => "shared"` (mirrored_edit) so any household member can add/edit/remove
   — this is a shared family calendar, not a per-person private one. Month grid, click a day to see
   what's happening + add an event, "This month's payments" list, Google Calendar sync shown
   locked/pending-verification (unchanged intent from the design pass — still blocked on a
   verified domain + OAuth review). Added to `components/Sidebar.tsx` nav.
   - **Payments-per-date overlay is read-only here, sourced from Finance's existing localStorage
     cache** (`lib/calendarPayments.ts` reads `finance.loans.v3` / `finance.subs.v3` /
     `finance.schemes.v1` — the same cache `useSupabaseSynced` keeps in sync with the real
     `finance_loans`/`finance_subscriptions`/`finance_payment_schemes` tables, and the same
     source `components/DashboardLiveWidgets.tsx` already used). **Known scope limit:** shows
     each bill's single *next* occurrence only (same as the Dashboard's existing behavior), not a
     full recurring projection painted across every month — flip to a future month and a monthly
     bill won't repeat there yet. Add/edit bills in Finance, not on the Calendar.

2. **Legal pages** (`app/legal/{privacy,terms,about,instructions}/page.tsx` + shared
   `components/LegalPageLayout.tsx`) — content adapted from scratch for Hari-CRM's actual data
   model (health records, financial data, invite-based household accounts, admin backup access),
   NOT copy-pasted from the user's `LEGAL-TEMPLATE-REUSABLE.md` DinoHistory template. That
   template explicitly flags itself as insufficient as-is for a project with user accounts or
   sensitive health/financial data — used it only for the page-shell pattern and the cookie-banner
   mechanism, wrote the actual legal content fresh. Privacy Policy specifically discloses: what
   Google/email auth collects, that health/financial data is never monetized, the
   private/shared/joint visibility model, and — importantly — that the admin can see a household
   list + export backups (a real, disclosable fact now that admin overview exists). **Not
   lawyer-reviewed** — flagged in this repo's memory as a known gap if the app ever moves beyond
   friends-testing into anything resembling a public/commercial launch.
   - `components/CookieConsent.tsx` — lightweight notice-and-acknowledge banner (not an
     accept/reject gate, since there's no analytics/ad cookie today to gate — only Supabase's
     necessary auth-session cookie exists). If analytics is ever added, its script must be gated
     behind an explicit "accepted" choice here, same pattern as the DinoHistory reference.
   - `components/LegalFooter.tsx` — link row wired into the public `/login` page (pre-auth) and
     into Settings (post-auth), so both signed-out and signed-in users can reach these pages.
   - `components/ProfileGate.tsx` — `/legal/*` added to the same skip-the-household-gate
     allowlist `/login` already had (standalone public pages, no PIN/profile flow).

3. **Small fix, user-reported mid-session:** Health → Allergy history's "add" box only had
   Household member + Trigger — Status/Reaction/Date/Notes only appeared after a second "edit"
   step. Added all fields to the initial add form (`app/health/page.tsx`,
   `AllergiesSection`/draft form) so everything saves together on first "Add allergy" click; no
   data-model change, `addEntry()` already carried the full draft.

4. **Not done this session — flagged, not forgotten** (user asked mid-session, answered inline,
   not built):
   - **Wearable health sync (Samsung Health / Apple Health / Health Connect).** No free way to
     pull this into a *web app* directly — HealthKit (iOS) and Health Connect (Android, which
     Samsung Health/Honor Health can write into) are native-only SDKs, not reachable from a
     browser. Free path: a companion native/PWA-wrapped app the household installs, or manual
     CSV/export-then-upload. Paid path: an aggregator like Terra API or Spike API (per-user
     monthly fee) that normalizes all three sources into one webhook/API Hari-CRM could consume.
     Real feature, real scope — not attempted this session.
   - **Optional stock-ticker dashboard widget (Yahoo Finance).** Feasible for free — Yahoo's
     official RSS feed is gone, but its unofficial JSON quote endpoints
     (`query1.finance.yahoo.com/...`) still work with no API key, just unsupported/rate-limited
     and could break without notice. Ties into the existing "Quick Launch is user-customizable"
     pattern (`lib/quickLaunch.ts`) — a configurable-widgets dashboard (spending trend, "where
     attention is going", stock ticker as swappable cards) is a real redesign of the Dashboard's
     fixed layout, not a quick add. Good candidate for its own focused session.



## Status: Multi-user household join flow + admin household overview/backup shipped, build-verified clean

**Live once pushed+deployed:** built from a fresh `git clone` in this session (not the mounted
workspace folder — see [[feedback_workspace_drift]]), `npm run build` — 0 errors, 19 routes
(new `/join`). `git diff --stat` against `origin/main` before committing showed only the files
intentionally touched this session — no drift.

**Why this session happened:** user's two close friends want to use Hari-CRM as real test users.
Surfaced a real gap: the only way to have multiple people in one household was the shared-login
Netflix-PIN model — there was no way for a second person to join with their OWN Google/email
account. Also added: household-level "head" role, and an admin household overview + JSON backup
(for pre-reset safety / future host migration).

**What shipped:**

1. **Invite-code join flow.** New Postgres migration `household_invites_and_head_role` (applied
   live via `apply_migration`, not just written to schema.sql):
   - `households.owner_id` — the household's "head" (backfilled to each household's
     earliest-created profile).
   - `household_invites` table (code, max_uses/uses_count, revoked, expires_at) — RLS: any
     household member can see their household's invites, only the head (or admin) can create/revoke.
   - `redeem_household_invite(p_code)` — SECURITY DEFINER function, the ONLY sanctioned way
     (besides admin) to move a profile's `household_id`. Validates the code, moves the CALLING
     user's own profile only, best-effort deletes the old household if it's now empty (handles the
     "just signed up, got a throwaway solo household, now joining a real one" case cleanly).
   - Hardening: a `BEFORE UPDATE` trigger (`prevent_direct_household_change`) now blocks a user
     from self-editing their own `household_id` directly through the normal `profiles_update` RLS
     policy (which previously allowed it — a latent gap, since a guessed/leaked household UUID
     could have bypassed the invite system entirely). The redeem function sets a transaction-local
     `app.allow_household_change` flag to get through its own trigger.
   - `components/HouseholdInvites.tsx` — Settings card (household members, non-admin) to generate/
     copy/revoke invite codes. Only the head sees the "generate" controls; any member can see
     pending codes (matches the RLS).
   - `app/join/page.tsx` — new page. Handles both "already signed in, just paste the code" and
     "not signed in yet" (Google button or a mini email+password form), by reusing the EXISTING
     `next=` passthrough already built into `GoogleSignInButton` + `/auth/callback` — no changes
     needed to signup, login, or the OAuth callback route. `?code=X&auto=1` round-trips through
     the whole auth chain and auto-redeems on landing.
   - **Known limitation, intentional for v1:** if someone who ALREADY has real data joins a
     different household via a code, their existing content rows stay keyed to their own
     `owner_id` and just follow them (visibility recalculates against the new household). Fine for
     brand-new test accounts (the actual use case right now); flag to the user if this ever comes
     up for an existing account.

2. **Admin household overview.** `AdminHouseholdOverview.tsx` (Settings, admin-only): every
   household, member count, head's name, last-sign-in-anyone (`auth.admin.listUsers()` +
   `profiles`), and a one-click **JSON backup** button (`backupHousehold()` in
   `app/settings/actions.ts` — exports household + profiles + all 21 owner-scoped tables, browser
   download, no server storage yet).

3. **NOT done this session (scoped out on purpose, not forgotten):**
   - **Restore from a backup JSON.** Design is decided (admin-only, validate shape, scoped
     delete+reinsert by `owner_id`, typed confirmation before running) but not built — export-first
     so real backups exist before anyone needs the destructive half. This is the very next piece.
   - **Finance page privacy toggle.** Real discovery this session: `lib/supabase/ownerMap.ts`'s
     `resolveOwner()` currently only ever produces `shared_view` (item assigned to a real member) or
     `mirrored_edit` (assigned to "shared") — it NEVER emits `private`, even though the DB column
     defaults to `private` and the visibility enum supports it. In practice today, every
     Finance/Health/etc. entry assigned to a specific person is already visible to the whole
     household — there's no way for a user to actually keep an item to themselves yet. Fixing this
     properly means extending `resolveOwner`/`useSupabaseSynced` with an explicit "keep private"
     flag (backward compatible — existing call sites unaffected) and wiring an actual toggle into
     the Finance UI (salary/income, loans, card balances were the ones asked about). Didn't touch
     `finance/page.tsx` (105KB, never fully read this session) blind under time pressure — safer to
     do this as its own focused pass with the design above already worked out.
   - **Supabase's native backups.** Couldn't check the project's billing plan / PITR status from
     available tools — ask the user to check the Supabase dashboard billing page directly.

4. **Also worth knowing:** `npm install` flagged Next.js 14.2.15 has a disclosed security
   advisory with a patched-version upgrade available (https://nextjs.org/blog/security-update-2025-12-11)
   — not touched this session (out of scope), but worth a deliberate upgrade pass at some point.

## Notes for next session
- Same fresh-clone + build-verify + `git diff --stat` workflow as prior sessions — this session
  had live GitHub push access via the session's own proxy-injected credential (no PAT paste
  needed this time; if that's not available next time, fall back to the PAT-paste workflow below).
- Test plan for the invite flow once deployed: generate a code from Settings as an existing
  household member, have a friend open `/join?code=...`, sign in with THEIR OWN Google account,
  confirm they land in the same household (not a new one) and can't see anything private to
  others. Confirm the OLD throwaway household created by their initial sign-up actually got
  cleaned up (`select count(*) from households where id = '<old id>'` should return 0).
- Next concrete pieces, in priority order: (1) Finance privacy toggle — plumbing design above,
  (2) Restore-from-backup UI, (3) actually verify the invite flow live with a real second Google
  account once deployed (couldn't do this from the cloud sandbox — needs the user's own test).

---

# Hari-CRM — Session Handover (2026-08-17, latest #19 — READ THIS FIRST)

## Status: All 6 of #18's items shipped & live (items 1,2,3,4,5,7) — item 6 still blocked on user data

**Live:** commit `8bbb258`, deploy `dep-da12ncoae00c7383sprg`, confirmed `status:"live"`. Build 0
errors, 16 routes. Unauthenticated fetch spot-check on `/finance` — redirects to `/login`, no 500.
Pushed with the fresh PAT the user pasted at session start (per usual, not persisted).

**What shipped, one commit, all of #18's build list except item 6:**

1. **Recurring income + live Spending Plan.** `finance_income` gained `is_recurring boolean` +
   `cadence text` ('monthly'/'yearly'); Shenaal's existing salary row was updated to
   `is_recurring=true, cadence='monthly'` in the same migration. New **Income section** in Standard
   view (add/edit/delete, pencil/check pattern) — this data had never been exposed in the UI before,
   only inserted via SQL last session. New **Spending Plan banner**
   (`SpendingPlanBanner` in `FinanceDeepView.tsx`) shown at the top of the page in both Standard and
   Deep view: recurring income − committed outflow, **converted to AED** (item 5), red when negative,
   reusing `spendingPlanStatus()`/`BUDGET_STATUS_CLASSES` — no new color logic. Shenaal's real
   ~-3,055 AED/month shortfall should now show up red once he marks his salary row recurring (it
   already is, from this session's migration) — **worth a quick visual check next session**.
2. **Unified Add Expense flow.** New `finance_expenses` table (`expense_type` enum
   monthly/fixed_term/one_off, `min_amount`/`max_amount`/`is_estimated`, `billing_day`/`start_date`/
   `end_date`/`due_date` as relevant per type, `notes`, `paid`). New **Expenses section** at the
   bottom of Standard view, same pencil/check edit pattern as everywhere else, type-specific fields
   swap in/out based on the selected type. Feeds into `monthlyOutflow` (face value) and the Spend
   Category donut (new "Other expenses" slice) same as Loans/Subs/Schemes do.
3. **`estimateFromRange(min, max, roundTo)`** in `lib/financeUtils.ts` — pure function, midpoint
   rounded to the nearest 5. Wired into the Add Expense amount field via an "I don't have an exact
   number" checkbox that swaps a single Amount input for Min/Max inputs + a live-computed estimate
   preview.
4. **Subscriptions gained `notes` + temporary-override** (`elevated_amount numeric`,
   `effective_until date`). Edit form has both; display row shows an "elevated until `<date>`" badge
   (accent-orange) while an override is active, and an italic notes line if set. `activeSubAmount(s)`
   is now the single source of truth used everywhere a sub's amount matters (monthly cost, upcoming
   payments, next-major-payment, the cash-flow projection) — auto-reverts to the baseline once today
   passes `effective_until`, no manual cleanup needed. **Tabby's spike and the ENBD credit card's
   extra interest still need the user to actually set these values in the UI** — the columns exist
   now but weren't backfilled with real numbers this session (wasn't asked to).
5. **Real currency conversion.** `fx_rates` seeded with live AED/LKR/USD mid-market rates fetched
   this session (1 USD = 3.6725 AED official peg, 1 AED ≈ 90.66 LKR). New `convertAmount()`/
   `convertTotalsToCurrency()` in `financeUtils.ts`, new read-only `lib/supabase/useFxRates.ts` hook
   (deliberately NOT `useSupabaseSynced` — this is a lookup table, no owner/visibility). Falls back to
   face value if a rate's missing, same disclosed convention as before. **Deliberately did NOT replace
   the existing face-value `monthlyOutflow`/category-donut/currency-bars figures** — per the ask, kept
   both: face-value sum stays exactly as before, real conversion is new and feeds specifically the
   Spending Plan (where an honest single number actually matters for the red/green call).
6. **Item 6 (ENBD Credit Card → `finance_cards`) intentionally skipped** — still waiting on the user's
   real credit limit + outstanding balance, asked twice now (session #18 and before), not yet
   answered. Ask again next session before attempting.
7. **Color coding.** Hoisted `COLORS`/`STATUS_HEX` out of `FinanceDeepView.tsx` into
   `lib/financeUtils.ts` (single source of truth now — `FinanceDeepView.tsx` just imports them). Every
   new component this session (Spending Plan banner, expense-type badges, override badge) reuses
   `accent.*`/`BUDGET_STATUS_CLASSES` — the only non-Tailwind-token hex anywhere is the pre-existing
   `COLORS.red`/`#f87171`, same one-time exception as before (no `accent.red` in `tailwind.config.ts`).

**One real bug caught and fixed mid-session, not just a feature note:** the first draft of the
Expenses section used template-literal Tailwind classes (`` `bg-${typeColor}/20` ``) for the
type badge. Tailwind's static scanner only picks up **literal** class strings present verbatim in
source — a JS-interpolated class name is silently dropped from the compiled CSS in both dev and
prod (not just prod), so those badges would have rendered unstyled. Fixed by switching to a
lookup returning one full literal class string per branch (`typeBadgeCls`). **Pattern to watch
for**: any future `className={`...${variable}...`}` with a variable Tailwind utility segment is
this same bug — always use a literal-string lookup instead.

**Not done this session, disclosed rather than skipped silently:** no real logged-in click-through
of the new Income/Expenses sections or the Spending Plan banner — same standing limitation as
every session (no household passcode given to Claude, by design). Next session or the user should:
sign in as Shenaal, check the Spending Plan banner shows red with a real negative number now that
his salary is marked recurring, add one test expense of each type (monthly/fixed-term/one-off) and
confirm it survives a refresh, and try the estimate-range toggle once.

## Also shipped this session — 2 Phase 0 backlog items (user asked for "another simpler task or two" after the Finance work above)

Both live, commits `46bd5ae` + `cc34cc9`, both build-verified 0 errors / 16 routes separately.

1. **Business page: editable project cards.** The 4 project tiles (ShelfPulse/RetailSuite/
   UnwindCircle/Dino History) were a hardcoded array — the `business_projects` table already existed
   in the schema (from session #7) but nothing ever wrote to it. Now wired via `useSupabaseSynced`,
   same pencil/check edit pattern as the rest of the app: hover a card to reveal edit/delete icons,
   permanent "Add project" card at the end of the grid (name/type/url/notes). The 4 defaults seed the
   table only the first time it's empty.
2. **Quick Launch customization.** New `lib/quickLaunch.ts` (shared type + `DEFAULT_QUICK_LAUNCH` +
   a literal-string color→gradient lookup, imported by both Dashboard and Settings so they can't
   drift). New Settings section: add/remove shortcuts, pick a color, optionally prefill label+URL
   from a `business_projects` row via a read-only dropdown. Per-device (`localStorage`), same
   convention as Finance's `budget`/`hideBalances` — these are UI shortcuts, not shared household
   data, so no schema table was added for this one.

**Real bug avoided proactively, not caught after the fact this time:** built both of these with the
literal-string Tailwind-class lookup pattern from the start (see the Expenses-section bug earlier
in this session and `feedback_tailwind_dynamic_classes` in memory) — Quick Launch's color picker
and Business's (none needed, no dynamic classes there) were designed around it rather than fixed
after.

**Not done, disclosed:** no real logged-in click-through of either feature (same standing
limitation). Next session or the user should: sign in, add/edit/remove a Business project card,
add a Quick Launch shortcut (try the "prefill from Business project" dropdown), confirm it shows up
on the Dashboard with the right color, remove it.

---

# Hari-CRM — Session Handover (2026-08-17, #18)

## Status: Finance "Deep view" toggle shipped & live; Shenaal's real finance data loaded; next up is closing the gaps that showed up from using real data

**Live:** commit `76ec81c`, deploy `dep-da129tm7bikc73ccnq6g` triggered automatically on push,
should be `status:"live"` by the time you read this (confirm with `get_deploy` if paranoid).
Build was 0 errors, 17 routes.

**What shipped this session:**
1. Finance page got a **Standard/Deep view toggle** (top-right, `localStorage: finance.viewMode`,
   per-device). Deep view is purely additive — 4 new charts (`components/finance/FinanceDeepView.tsx`,
   recharts) above the existing sections: 12-month **projected cash flow** (real math, new
   `projectMonthlyOutflow()` in `lib/financeUtils.ts` — loans drop off at tenure end, yearly
   items land only in their real due month), a **spend-category donut** (loans/cards/subs/
   schemes split), a **budget gauge** (hand-rolled SVG, reuses existing `budgetStatus()`
   red/orange/green/blue), and **per-currency balance bars** (hidden behind the existing
   `hideBalances` toggle, doesn't try to blur SVG text).
2. **Shenaal's real household finance data is live in Supabase** — user pasted a full snapshot
   from another project and asked me to enter it via SQL rather than the UI. Salary income,
   balance snapshot, ENBD Personal Loan (principal AED 60,843.94 + 10.74% rate **back-solved
   exactly** from the given EMI/remaining-balance/payments-made — verified it reproduces
   the exact AED 33,663.71 remaining balance), 12 recurring subscriptions, rent as a
   2-installment payment scheme (exact Sept 14 / Dec 14 2026 dates). All 4 originally-unknown
   due-days were asked (not guessed) and corrected: ENBD Personal Loan is the 27th (deducted a
   day before salary — brief negative-balance pattern, see gap #1 below), Car Finance the 1st,
   ENBD Appliance + Phone EMIs both the 4th (same as the credit card statement date).

**Environment note:** hit a `/tmp` disk-full wall this session from a previous session's
leftover work directories with no delete permission — worked around it by symlinking that
old session's still-readable `node_modules` into a fresh rsynced source tree instead of a full
`npm install`. If `/tmp` is full again next session, try that trick before spending a long time
on cleanup (`ls -ld /tmp/*/node_modules`, symlink one in rather than reinstalling).

## Next session — user's explicit ask (2026-08-17), in priority order

Using Shenaal's real data surfaced concrete gaps between what the schema holds and what a real
household budget needs. The user has now explicitly asked for all of the below — build in this
order, each is meaningfully separate work:

1. **Real income vs. outflow math — the biggest gap.** `finance_income` is point-in-time only;
   nothing today subtracts outflow from income anywhere in the app, despite Shenaal's real numbers
   showing an actual **-3,055 AED/month shortfall** that's currently invisible. Add a recurring-income
   concept (simplest: a per-household "monthly income" setting, same pattern as the existing
   `finance.monthlyBudget`, or a proper `is_recurring`+`cadence` pair on `finance_income` if multiple
   income sources need tracking separately — Shenaal salary vs. Shalini's currently-AED-0). Then build
   the actual Simplifi "Spending Plan": safe-to-spend = income − committed outflow, live, shown
   prominently in Deep View, **red when negative** (reuse `BUDGET_STATUS_CLASSES`/`accent` palette,
   don't invent new colors) — this is the single most requested piece of Simplifi-style math from the
   original LifeOS strategy session ([[project_hari_lifeos_strategy]]).
2. **Editable, unified expense entry — add/remove monthly, fixed-term, and one-off expenses from one
   place.** Right now a new expense has to be shoehorned into whichever of loans/subscriptions/schemes
   happens to fit, and pure one-off costs (e.g. the car registration renewal, ~AED 500, no fixed date)
   have nowhere to go at all. Build a single "Add expense" flow with an explicit `type`: **monthly
   recurring** (subscriptions-shaped), **fixed-term** (has a start + end, like a loan/EMI), or
   **one-off** (single date, no recurrence — new lightweight table or a relaxed payment-scheme-item
   that doesn't require a parent scheme). Every entry must be fully editable in place afterward
   (pencil/check pattern already used everywhere else in the app — see
   [[feedback_finance_editability]] — don't reintroduce the old "add-only, no edit" gap).
3. **Estimated-figure entry with auto-midpoint rounding.** When the user doesn't have an exact
   number (e.g. "DEWA is AED 350–500, varies seasonally" — this session I hand-averaged several of
   these to insert Shenaal's data), let them enter a **min–max range** instead of one number, and
   auto-compute the stored/displayed figure as the midpoint **rounded to the nearest sensible value**
   (e.g. nearest 5 or 25, not a raw decimal) — write this as a small pure function in
   `lib/financeUtils.ts` (`estimateFromRange(min, max, roundTo)`), same testable-pure-function pattern
   as `calcEMI`/`projectMonthlyOutflow`, and reuse it wherever an amount field appears in the new
   unified expense flow.
4. **Notes field + "temporarily elevated" amounts.** `finance_subscriptions` has no notes/description
   column (accounts and loans both do — this session hit that gap directly: Tabby's 4-month spike to
   AED 900-1,000 and the credit card's extra ~AED 100-120/mo interest-on-minimum had nowhere to be
   recorded and are only noted here in this doc). Add a `notes` column via migration, and consider a
   simple `effective_until` date + `elevated_amount` pair so a temporary override doesn't need a
   free-text workaround and automatically reverts to the baseline after the date passes.
5. **Real currency conversion.** `fx_rates` exists but has 0 rows — every multi-currency total on the
   page (`totalsByCurrency`, `monthlyOutflow`, the new cash-flow chart) sums **mixed currencies at
   face value**, disclosed in the UI copy but not actually converted. Populate real AED/LKR/USD rates
   (fetch live via a free FX API, or let the user set/update them in Settings) and add a toggle or
   secondary total showing the real converted figure — keep the existing face-value sum too rather
   than silently replacing it, since some users may prefer seeing raw per-currency numbers.
6. **Move ENBD Credit Card into `finance_cards` properly** once the user gives its real credit limit
   and current outstanding balance (asked, not yet answered) — right now it's parked as a generic
   subscription line, losing the app's existing card-EMI machinery.
7. **Color coding** — the user explicitly asked for this to follow the existing schema palette. Every
   new UI from items 1-4 above (Spending Plan banner, unified expense type badges, category chips)
   should reuse `tailwind.config.ts`'s `accent.{purple,pink,blue,orange,green}` and the existing
   `BUDGET_STATUS_CLASSES`/`FinanceDeepView.tsx`'s `COLORS` constant — don't introduce new hex values
   ad hoc per component, keep one source of truth (consider hoisting `COLORS`/`STATUS_HEX` out of
   `FinanceDeepView.tsx` into `lib/financeUtils.ts` or a new `lib/theme.ts` if more components start
   needing them).

**Also still open from earlier sessions, lower priority than the above:** RLS penetration audit,
Cozi-style calendar/lists module (Google Calendar sync is safe to build now under Google's Testing
mode, same as existing Google sign-in — full verification only needed past 100 test users), Rocket
Money-style smart alerts/net-worth rollup. Full BACKLOG.md has the checkbox-tracked version.


## Status: Phase 1 of BACKLOG.md shipped — signup, Google login (code done), 2FA, password reset
Commit `f290ca9`, deploy `dep-da0v87qd0e5s73aud3qg` (confirmed `status:"live"`). Build 0
errors, 17 routes (added `/signup`, `/forgot-password`, `/reset-password`, `/login/mfa`,
`/auth/callback`). Push token pasted fresh at session start (per usual). Unauthenticated
curl spot-check on all 5 new routes: 200, no 500s. `get_advisors` (security) run after the
new `handle_new_user_household()` trigger — no new findings, only pre-existing ones.

**What shipped:**
1. **Real signup** — `/signup` (client-side `supabase.auth.signUp()`, no service_role
   needed) + a `handle_new_user_household()` trigger on `auth.users` insert that atomically
   creates the matching `households` + `profiles` rows (household name + display name come
   from `signUp()`'s `options.data`, or from Google's profile data on first OAuth login).
   Replaces the old hand-seeded-SQL-per-household workaround for *new* households going
   forward — existing 4 households untouched.
2. **Google sign-in** — `GoogleSignInButton.tsx` + `/auth/callback` (PKCE code exchange,
   shared by OAuth/email-verify/password-reset links) are done and deployed, but **the
   button will error until Google OAuth creds are set up** — see `GOOGLE-OAUTH-SETUP.md`
   for the exact 2-step manual process (Google Cloud Console Client ID/Secret → paste into
   Supabase Dashboard → Auth → Providers → Google). No MCP tool can do this step.
3. **Password reset by email** — `/forgot-password` + `/reset-password`, native Supabase
   Auth, generic "if that email exists" message either way (no email-enumeration leak).
4. **Optional TOTP 2FA** — Settings → Security now has real enroll/verify/disable UI
   (`TwoFactorSettings.tsx`, replacing the old placeholder paragraph). `/login/mfa` is a
   full-screen step-up gate (with a logout escape hatch — learned from the #10/#11
   PinSetupGate incident) enforced in `middleware.ts` via
   `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. Off by default, zero behavior
   change for existing accounts until someone opts in.

**Found and fixed a data-integrity issue, not just app code:** the synced workspace
folder's copies of `lib/HouseholdContext.tsx`, `VisionBoard.tsx`, `VisionGoals.tsx`,
`health/business/memberships/vision` pages, `HANDOVER.md`, `PROJECT-STATUS.md` had drifted
stale — reflecting an *older* pre-#13-hardening version than what's actually live on
GitHub/Render. Caught via `git diff` before committing (would have silently regressed the
retry-with-backoff/self-floor/refocus-refetch fix from session #13 if pushed blindly).
Restored from `origin/main` into the workspace folder instead of committing the stale
versions. Also committed `BACKLOG.md` and `LifeOS-Billion-Dollar-Strategy.md` to git for
the first time — they only existed in the local workspace folder before, unprotected by
version control.

**Manual steps still needed from the user (no MCP tool can do these):**
- Google OAuth Client ID/Secret → Supabase Dashboard (see `GOOGLE-OAUTH-SETUP.md`).
- Verify "Confirm email" is ON in Supabase Dashboard → Auth → Providers → Email (can't be
  read or set via any available Supabase MCP tool — dashboard-only).
- Optional, surfaced by this session's `get_advisors` run: "Leaked Password Protection" is
  OFF — a free one-click toggle in Supabase Dashboard → Auth → Providers → Email that
  checks new passwords against HaveIBeenPwned. Not done, just flagged.

**Not done this session:** no real logged-in click-through test of the new signup/2FA/reset
flows (would need a throwaway email account + Claude doesn't have/shouldn't have real
household passcodes). Next session or the user should: sign up a fresh test household end
to end, enroll 2FA on one account and confirm the `/login/mfa` gate actually appears on
next login, and once Google creds are pasted in, test the Google button.

---

# Hari-CRM — Session Handover (2026-08-16, #12)

## Status: all 4 backlog items from #11 shipped, build-verified, pushed, deployed live
Commit `5c73c70`, deploy `dep-da0t7vdg1s2s73bqa68g` (confirmed `status:"live"`). Build
0 errors, all 11 routes. Push token was pasted fresh at session start (per usual — nothing
persisted). Unauthenticated fetch spot-check on `/vision` confirmed no 500 (redirects to
`/login` as expected). **No real logged-in click-through was done this session** — Claude
doesn't have and shouldn't be given the household login passcode (never persisted by
design). Next session or the user should do one real pass: sign in as Shenaal, check all 4
Finance tabs render, edit a Membership/Allergy/Vision-goal card via the new pencil icon,
switch Vision board tabs, upload a photo and eyeball that it's smaller / actually WebP.

1. **Finance tabs bug — actual root cause found**, not just re-tested. In
   `lib/HouseholdContext.tsx`'s `loadRealHousehold()`, the `profiles` roster query's
   `{ data, error }` only ever read `data`. On a transient fetch error (network blip, RLS
   hiccup), `data` came back `null` → `rows ?? []` → empty array → `mergeRealMembers()`
   treated "fetch failed" as "this household has zero other real members" and **wiped**
   the real member cache down to just non-uuid custom-label extras. Every module renders
   tabs as `[...members, SHARED]`, so that's exactly "Household + Shared only" — self-heals
   on the next successful fetch, which is why it looked fine when re-tested live last
   session. Fixed: only update `members` when the query comes back error-free; an error
   now means "don't know, keep the existing cache" instead of "empty, wipe it."

2. **Collapse-to-card + edit pattern, everywhere** — the biggest item. Finance's existing
   pencil-icon/summary-row pattern was already correct and used as the template (no changes
   there). Two distinct gaps found and fixed:
   - `MembershipCard`, `AllergyCard`, `InsuranceCard`, `GoalCard` (Vision) were always fully
     open as a giant form, forever — exactly what you flagged. Each now collapses to a
     summary once its identifying field (name/trigger/provider/title) is filled, pencil icon
     to expand, check icon to collapse. Blank/new entries start expanded. No draft/save-cancel
     needed — these already auto-save every keystroke, so "Done" just toggles a local
     `editing` boolean.
   - `ConditionsSection`/`AppointmentsSection` (Health) and Business's idea journal had the
     opposite problem — **no edit at all**, delete-and-recreate only. Added small row
     components (`ConditionRow`, `AppointmentRow`, `IdeaRow`) with the same pencil/check
     toggle, local state per row — same pattern Business's pre-existing `StackRow` already
     used correctly.

3. **Vision board: individual + shared boards.** `BoardItem` gained `boardId` (real profile
   uuid, or `"shared"`). Tab selector (same visual pattern as Finance/Memberships) sits above
   the mood board; new items tag to whichever tab is active; "Clear board" only clears the
   active board now, not everything. Pre-existing items with no `boardId` migrate to
   `"shared"` automatically on first load, once. Still 100% localStorage — pure client-side
   scoping, no Supabase schema touched (that part of the original ask — real cloud sync for
   the board — is still the separate, bigger `board-images` bucket task below).

4. **WebP compression on photo uploads.** New `compressToWebp()` in
   `components/VisionBoard.tsx`: downscales to max 1600px on the long edge via an off-screen
   canvas, re-encodes with `toDataURL("image/webp", 0.82)`, falls back to the original if
   WebP encoding isn't actually supported (checks the result really starts with
   `data:image/webp` — some browsers silently give back PNG instead of erroring). Directly
   addresses the long-standing "~5-10MB localStorage cap" limitation.

**Also surfaced:** `next@14.2.15`'s security advisory is now flagged as **critical** by npm
(previously just "known") — see nextjs.org/blog/security-update-2025-12-11. Worth a version
bump soon; still low-urgency for a private household app. NSAID orphan allergy row from #11
is unchanged — still needs manual delete/reassign via Health → Allergies UI.

---

# Hari-CRM — Session Handover (2026-08-16, latest #11)

## Status: App confirmed ready for real data. 2 more real bugs found + fixed + deployed live.
User asked point-blank: is everything saved to Supabase, can they start entering real
finances etc.? **Yes** — Finance, Health (conditions/allergies/appointments), Business,
Memberships, Vision goals/trips are all live on Supabase. Only Health Insurance (no table
yet) and Vision board photos (still localStorage data-URLs) are local-only, by design, not
a bug.

Did the 3 requested follow-ups from #10, in order:

1. **NSAID orphan allergy row (item 3)** — DB writes to `health_allergies` got blocked
   by the safety classifier (same intermittent block as the earlier password-reset issue).
   Left the row in place with a note flagging it as an orphan test row — **user should
   delete/reassign it via Health → Allergies UI directly**, didn't force it via more SQL attempts.
2. **Natasha & Arun's one-time password (item 2)** — done via the admin panel's "reset a
   household's login" (the proper Admin-API path, not raw SQL). Confirmed via
   `auth.users.updated_at`. **Told the user the temp PIN in chat — not saved to any file.**
3. **PinSetupGate end-to-end verification (item 1)** — while testing this, found and fixed
   two real bugs:
   - **PIN gate briefly showed the previous account's dashboard.** Root cause: logging in
     is a server-action `redirect()`, a soft client nav, so `HouseholdContext` never
     remounts. The #10 fix's `onAuthStateChange` listener does refetch who's-signed-in
     correctly, but `ready` stayed `true` the whole time, so `ProfileGate` rendered
     stale/previous-account content for the ~1-2s the refetch took — a real privacy leak on
     a shared device. Fix: drop `ready` back to `false` during the refetch, same pattern as
     the initial mount effect. Pushed `92022b4`.
   - **No way to log out from any of the 3 full-screen auth gates** (PinSetupGate, the
     "Who's using" picker, the PIN-entry pad) — hard blocks, no back button, no logout.
     User caught this live via screenshot. Added a "Log out" link to all three (same
     storage-clear + `logout()` pattern Sidebar already used). Pushed `a762f75`.
   Both build-verified 0 errors, both deployed live (`dep-da0s16p5efls73diskj0`,
   `dep-da0s4i8ae00c73fu6a50`, confirmed `status:"live"`), both re-verified end-to-end in
   Chrome after deploy (fresh hard-reload login → picker → PIN → dashboard, logout link
   visible and working on all 3 gates).

**New backlog from this session, not yet started — user flagged all of these live while
testing, next session should tackle in this order:**

1. **"Card" pattern needed across every module, not just Allergies/Memberships**: right now
   several add-forms (Membership add, Allergy history, likely others) stay as a big open
   editable form filling the screen even after saving — user wants it to collapse into a
   compact card after save, with a clear edit affordance, and explicitly: **"ALL cards in
   any topic should be editable."** Needs an audit of every module (Health, Finance,
   Business, Memberships, Vision) for which entities currently lack this collapse-to-card +
   edit pattern, then one consistent fix applied everywhere. Biggest item on the list.
2. **Finance individual-tabs report needs re-checking with the user.** User said Finance
   only showed "Household" + "Shared" tabs, not per-person Shenaal/Shalini tabs. When
   checked live as Shenaal this session, all 4 tabs (Household/Shenaal/Shalini/Shared) DID
   render correctly — so either it was a different account/household (e.g. a single-member
   household like Natasha & Arun or Shannon genuinely has no second person to split by,
   which would be correct behavior, not a bug), a stale cached bundle on their device, or
   something else. Ask user which household/device they saw this on before assuming a bug.
3. **Vision board needs individual + shared boards per person**, not just one shared board —
   user wants each profile to feel ownership of their own board. Currently `VisionBoard.tsx`
   is a single flat mood-board, no per-member split at all. Real feature work, ties into the
   already-known "still localStorage, needs Supabase storage wiring" item.
4. **Vision board image uploads should be compressed/converted to WebP** before storage, to
   keep the eventual Supabase `board-images` bucket (and localStorage in the meantime) from
   bloating — do this as part of the Supabase image-wiring work, not bolted on after.

---


## Status: Admin UI was invisible after switching accounts in-tab — FIXED
User signed in as Shenaal then admin (same tab) and Settings showed none
of the admin-only sections. DB/RLS were fine (verified via REST with a
real admin JWT) — it was `HouseholdContext.tsx` only ever fetching
isAdmin/householdId/members once on mount, and account switches via
`redirect()` being a client-side nav that never remounts the layout. Now
subscribes to `supabase.auth.onAuthStateChange` and re-fetches (+ clears
`ownerMap.ts`'s cache) on any real account change. Pushed `fbded2c`,
deployed live. **Ask the user to hard-refresh once** to pick up the new
bundle before re-testing — should self-correct from here on without
needing a refresh on future account switches.

This is the 3rd instance this session of "stale per-browser client state
surviving an account switch" (member-picker leak, then ownerMap's
`"shared"` fallback, now this). If another "shows the wrong account's
data" report comes in, check for this pattern first.

---



## Status: Multi-household live, 2 real bugs found by hand-testing + fixed
User clicked through the app for real and found what code review/REST
checks missed. Both fixed, build-verified, pushed `807bc0d`, deployed
live (`dep-da0bu1u7bikc73bsvil0`). Full writeup in memory
(`project_hari_crm.md` entry #9) — short version:

1. **Member picker leaked across households** (Shannon showing up while
   signed in as Shenaal) — `localStorage` is shared per-browser across
   whichever account is signed in; `HouseholdContext.tsx`'s merge logic
   now drops stale real-profile ids not in the current fetch instead of
   keeping them. Logout also now clears the relevant storage keys.
2. **Health → Allergies mis-attributed entries + felt like no "save"** —
   Health's member dropdowns were missing the "Shared" option that
   Finance already had, so `ownerMap.ts`'s `"shared"` fallback had
   nothing to match and the browser silently showed whichever member was
   first in the list. Added `withShared()` to all 3 Health dropdowns;
   Allergies "Add" now requires a trigger name before it saves anything
   (previously inserted a blank row into Supabase immediately on click).

**One cleanup item left over**: a stray test row in `health_allergies`
("NSAIDs", from admin testing before a household was selected) now shows
as "Household (shared)" but isn't really anyone's — reassign or delete it
next time you're in Health → Allergies.

**Logins:**
- Shenaal: `hilaryuae@gmail.com` (unchanged)
- Shalini: `shalunayanthara@gmail.com` (unchanged)
- Shannon: `shannondekretser@gmail.com` / `492443` — own household, works now
- Natasha & Arun: `eskondido@hari-crm.app` — **still needs a one-time temp
  password set before first use** (unresolved from session #8 — sign in
  as admin, Settings → "Admin — reset a household's login", set a temp
  password with "force PIN setup" checked, hand it to them).
- Admin: `admin@hari-crm.app` / `277469` — email was corrected from
  `admin@hari` this session (no-TLD address passed the backend but failed
  the app's own login-form validation). No household of its own,
  sees/edits everything via the Settings household switcher.

**Still not done:** full in-browser click-through of PinSetupGate and the
admin account-recovery panel specifically (the two bugs above were found
via the *existing* pages, not these newer ones — they haven't been
exercised by a real human yet). Do this next, now that member-picker
integrity is fixed — testing those flows earlier might have been
confused by the leak bug.

**If you touch RLS again:** every content table's policies now go through
`install_household_rls()` (household-scoped + `is_admin()` bypass) —
don't hand-write a new one-off policy, extend that procedure instead so
it stays consistent everywhere.

**If you touch any other page's member dropdown:** check it includes the
`SHARED`/`"shared"` option (Finance's pattern, now also in Health) —
`ownerMap.unresolveOwner()` can return `"shared"` for any table, and a
dropdown missing that option will silently mis-render, exactly like the
Allergies bug above. Business and Memberships haven't been audited for
this yet.

---



## Status: Supabase data-wiring pass DONE (except Insurance + VisionBoard, both explicitly scoped out)
This was the "only work left project-wide" pass. Pushed as two commits
(`0a8ddec` Finance, `a1f9687` Health/Business/Memberships/Vision goals +
Payment schemes), both deployed live on Render (`dep-da0aud8ae00c73fj43vg`,
`dep-da0b0f8ae00c73fj61ag` — both status `live`), both build-verified clean
(0 errors, all 12 routes) before pushing. Confirmed the live URL serves
correctly post-deploy (`/finance` redirects to `/login` as expected, no
500/blank page). **Full in-browser data-persistence verification (sign in,
add a record, refresh, confirm it reloads from Supabase) was NOT done this
session** — the Claude-in-Chrome extension wasn't connected. Do this first
thing next session: sign in, add one item in each module, hard refresh,
confirm it's still there (that's the real test, not just that the UI
updates optimistically).

Every module except two is now live-synced: Finance (accounts, cards, card
spends, loans, subscriptions, payment schemes), Health (conditions,
allergies, appointments), Business (idea journal, program stack),
Memberships, Vision goals/trips. Deliberately still local, both disclosed
rather than hacked in:
- **Health Insurance** — needs its own proper table (current `health_records`
  is too generic for policyholder/copays/allowances/coverage-notes) plus
  wiring the 4 file uploads to the `health-documents` storage bucket
  (currently data-URLs in localStorage). Worth its own focused session.
- **VisionBoard** (mood-board photos/sticky notes) — same story, needs
  real image uploads to `board-images` plus x/y/w/h/z position sync, not
  flat-row CRUD. Long-standing known limitation, unchanged this session.
- **Finance budget + hideBalances** — deliberately local, per-device UI
  prefs, not shared data. Not a gap.

### Schema migration applied this session (`add_finance_field_gaps_and_new_modules`)
- `finance_accounts` gained `bank_url text`
- `finance_loans` gained `account_number text`
- `finance_subscriptions` gained `billing_day int`, `tax_pct numeric`, `tenure_months int`
- New tables (all via `install_household_rls()`, RLS confirmed clean by
  `get_advisors`): `memberships`, `vision_goals`, `business_stack`,
  `health_allergies`. Exact columns are in `schema.sql`'s live counterpart —
  check `list_tables` on project `pfchzkcteymiigsdokeo`, not the `schema.sql`
  file (it's now behind the live DB by these 4 tables + these columns —
  worth a follow-up commit to sync `schema.sql` itself, low priority).

### New reusable infra (`lib/supabase/`)
- **`ownerMap.ts`** — resolves the local `HouseholdContext` ownerId
  (`"shenaal"|"shalini"|"shared"`) to a real `{owner_id, visibility}` pair
  and back. This was the locked design from earlier sessions, now actually
  implemented. Cached per page load; call `clearOwnerMapCache()` after
  sign-out if multi-account switching ever becomes a thing.
- **`useSupabaseSynced.ts`** — drop-in replacement for `useLocalStorage<T[]>`
  with the exact same `[value, setValue]` signature. This is why Finance's
  JSX/handlers needed **zero changes** — only the hook-declaration lines
  did. Give it a table name, a localStorage cache key, an initial value,
  and a `{toRow, fromRow, ownerLocalId}` mapper; it diffs on every
  `setValue` call and pushes insert/update/delete to Supabase, reconciling
  locally-generated temp ids with the real DB-generated uuid afterward.
  **Use this same hook for Health/Business/Vision/Memberships** — don't
  reinvent it.

### Finance — what's wired vs. deliberately deferred
Wired via `useSupabaseSynced`: `accounts` → `finance_accounts`, `cards` →
`finance_cards`, `cardSpends` → `finance_card_spends`, `loans` →
`finance_loans`, `subs` → `finance_subscriptions`. See the mapper functions
inline in `app/finance/page.tsx`'s hook-declaration block for the exact
column mapping (note: `Loan.lenderType` is stored in the `lender` text
column since the schema never got a proper lender-name field — repurposed
rather than migrated again, flagged in a code comment).

**Deliberately still localStorage-only**, disclosed rather than rushed:
- `schemes` (Payment schemes) — nested two-table shape
  (`finance_payment_schemes` + `finance_payment_scheme_items`), doesn't fit
  the generic flat-array hook. Needs a bespoke sync effect. Do this next —
  it's the last Finance gap.
- `budget` (monthly budget number) and `hideBalances` (blur toggle) — pure
  per-device UI preferences, no schema column exists or is needed for
  these; leaving on localStorage is a deliberate choice, not a gap.

**Known minor edge case** (documented in `useSupabaseSynced.ts`'s header
comment): if you reference a just-added row's id before its insert
round-trip completes (e.g. logging a card spend the instant after adding
the card), the reference may briefly point at the temp id instead of the
real one. Not an issue at normal human interaction speed; not solved,
just disclosed.

### Next session, in this order
1. **In-browser verification** (see above — this is the actual next step,
   nothing was verified end-to-end this session beyond a clean build + a
   healthy deploy response).
2. **Health Insurance**: design a proper table (or extend health_records
   with the missing columns — policyholder_name, renewal_date, copays,
   allowances, coverage_notes — plus 4 file_path-style columns) and wire
   the `health-documents` bucket for the 4 uploads.
3. **VisionBoard**: image upload to `board-images` bucket + position sync.
   Bigger, more isolated piece of work — good standalone session.
4. Nice-to-have cleanup once the above are done: bump `schema.sql` to match
   the live DB (4 tables + several columns were added this session via
   `apply_migration` directly, not reflected in the file), and re-tightening
   RLS/CSP polish items already flagged in earlier HANDOVER entries.

---


## Status: the entire 2026-08-14 6-part feature request is DONE
User's original 6-part request (household PIN split, Health sections,
Finance, Business, Vision trips/goals, Memberships) is **fully built,
build-verified, and live** as of this session. Nothing from that list is
outstanding. Commits, newest first: `db0bf9a` (Dashboard live Finance
widgets), `b6990c2` (Finance field gaps), `b56e2f6` (Vision trip detail
pages), `8ed9fe8` (Memberships module), `c872cf7` (mobile back button +
Vision goals list + Health allergies), `0b6f275` (logout button).

Per-item final state:
1. **Household split + PIN** — done. `app/settings/page.tsx`:
   add/remove/rename members + `PinManager` (6-digit set/change/remove).
   Local-only (`HouseholdContext`), not yet tied to real per-user Supabase
   rows — that's covered by the Supabase wiring pass below.
2. **Health** — done. `app/health/page.tsx`: Conditions & History,
   Allergies (trigger/status/reaction/date), Appointments (member
   quick-selector), Insurance (policyholder/expiry/renewal/copays/
   allowances/coverage notes + 4 file uploads, open-in-tab/download).
3. **Finance** — done. `app/finance/page.tsx`: per-user split + combined
   "Household" filter, blur-to-reveal balances, Cards (last-4, EMI/limit/
   APR auto-calc, `account_kind` enum credit/debit/current/checking/
   savings/BNPL), card spend log w/ per-entry currency, Loans (EMI/
   remaining-balance math, account number), Payment schemes (multi-line
   plans w/ timeline), Subscriptions (currency/tax/tenure), budget red/
   orange/green status, Accounts (bank URL + never-save-login-details
   warning), "Upcoming (14 days)" + "Next major payment" widgets. Storage
   keys are `finance.accounts.v4`, `finance.cards.v4`, `finance.loans.v3`,
   `finance.subs.v3`, `finance.schemes.v1`, `finance.cardSpends.v3` — bump
   the version suffix again if you add more required fields (placeholder
   data at old versions is intentionally orphaned, not migrated).
4. **Business** — done. `app/business/page.tsx`: UnwindCircle +
   dinohistory.com links, idea journal draft-persists every keystroke,
   Program stack (Render/GitHub/Supabase/Cloudflare/Spaceship presets,
   custom URL, masked email/username w/ reveal).
5. **Vision — trips/bucket list** — done. `components/VisionGoals.tsx` (list
   + ticket-price/link fields) + dynamic `/vision/trip/[id]` detail page:
   cost breakdown for Trips (travelers/one-way/round-trip per person, live
   totals) + 11 travel-site shortcuts; region-grouped ticket-site shortcuts
   for Experiences (UAE/Sri Lanka/US — domains confirmed via web search).
6. **Memberships** — done. New `app/memberships/page.tsx`: club/warehouse
   memberships + loyalty cards, per-member filter, category, fee+currency,
   renewal cadence, renewal/expiry date badges, portal link, notes. In
   Sidebar nav + Dashboard's module-shortcut row (5 tiles).

Also done this session, not part of the original 6: logout button
(bottom-left of Sidebar), mobile back-arrow (top-left, mobile only), and
the Dashboard home page now reads real Finance data
(`components/DashboardLiveWidgets.tsx`) instead of hardcoded placeholders —
live "Upcoming payments (14 days)" card + budget-status dot next to
"Spending trend". The spending-trend chart and category-donut percentages
are still cosmetic placeholders (not part of any explicit ask).

## What's actually left: the Supabase data-wiring pass
Every module above (Health/Finance/Business/Vision/Memberships/Settings)
is still 100% localStorage — nothing reads or writes the live `schema.sql`
tables yet, even though the schema, RLS, and real auth are all in place and
working (see the section below this one for the full owner-mapping design
and exact per-page order). This is the one remaining piece of work
project-wide, roughly ~1900+ lines across 5 pages now (grew slightly with
Allergies/Memberships/trip-detail added this session). Recommended order:
Finance first (has the most precedent/complexity — Cards/Loans/Schemes),
then Health, then Business, then Vision (incl. the new trip-detail page),
then Memberships, then Settings/household members last (touches auth).

---

# Hari-CRM — Session Handover (2026-08-15, later)

## AUTH IS NOW LIVE + DATA-WIRING DESIGN LOCKED IN (2026-08-15, continued)

**Real login works.** Two `auth.users` seeded directly via SQL (no admin-API
tool in this MCP, used `crypt()`/pgcrypto + manual `auth.identities` row —
documented workaround, see migration `seed_household_auth_users_v2`):
- `hilaryuae@gmail.com` → `profiles.role = 'Shenaal'`
- `shalunayanthara@gmail.com` → `profiles.role = 'Shalini'`
- Shared passcode: a 6-digit code the user provided in chat (not repeated
  here — this file is committed to git, not gitignored). Below the original
  8-char zod minimum — relaxed to `min(6)` in
  `login/actions.ts` + `login/page.tsx`'s `minLength`. Security tradeoff is
  intentional/accepted: private 2-person app, already behind the existing
  5-attempts/15-min lockout (`check_login_allowed`).
- `middleware.ts` real auth gate is back in (temp early-return removed).

**LOGIN FULLY VERIFIED LIVE** (2026-08-15, continued further): user provided
the service_role key, set on Render (`srv-d9vkoo3m8hqs739jj5d0`) +
`.env.local`, pushed (`911a50c`), deployed (`dep-d9vorpk9v7es739voqsg`,
live), and tested end-to-end in-browser — signed in as Shenaal at
hari-crm.onrender.com, landed on the household profile picker. **Real auth
is done, no more auth work needed.** Only the data-wiring (below) remains.

**Schema gap found + fixed:** `schema.sql` never had tables for Cards, Card
Spends, or Payment Schemes (those Finance features were built after the
original schema). Added this session (migration
`finance_cards_and_payment_schemes`): `finance_cards`, `finance_card_spends`,
`finance_payment_schemes`, `finance_payment_scheme_items` — shapes matched
exactly to what `app/finance/page.tsx` already uses. Also added
`finance_accounts.account_kind` (bank/bnpl) since the original schema's
`account_type` was a freer text field, not the exact enum the UI uses.

**Owner-mapping design (apply this pattern to every page's Supabase wiring):**
The app's local "who owns this" concept (`ownerId: "shenaal"|"shalini"|"shared"`
from `HouseholdContext`) does NOT match the schema's `owner_id uuid NOT NULL
+ visibility` model 1:1 — there's no such thing as a "shared" owner_id, only
a real person's uuid plus a visibility level. Resolved as:
- local `"shenaal"` / `"shalini"` → real `profiles.id` for that role,
  `visibility = 'shared_view'` (both can see, only true owner edits)
- local `"shared"` → `owner_id` = whichever real auth user is currently
  logged in (the creator), `visibility = 'mirrored_edit'` (either real user
  can edit regardless of who created it)
- Reading back: `visibility = 'mirrored_edit'` → local id `"shared"`;
  otherwise reverse-map the real owner uuid → `"shenaal"`/`"shalini"` via
  `profiles.role`.
This preserves 100% of the existing UI/UX (OwnerSelect, filter tabs, all JSX)
unchanged — only the data-loading and mutation functions change. Build a
small `lib/supabase/ownerMap.ts` helper (fetch `profiles`, expose
`localToDb(localId, currentUserId)` and `dbToLocal(row)`) and reuse it
across Finance/Health/Business/Vision instead of rewriting this logic per page.

**Why the local PIN-picker (`HouseholdContext`) stays as-is:** it was never
real access control (any browser could already see all locally-stored data
regardless of which profile was "active" — it's a Netflix-style convenience
switcher, not a security boundary). Real RLS is the actual boundary now.
Don't try to wire the PIN-picker into `auth.uid()` — that's a different,
bigger redesign (each person would need their own real login session) and
isn't what was asked for.

**NEW SESSION — start here, in order:**
1. Build `lib/supabase/ownerMap.ts` (pattern above — fetch `profiles`,
   `localToDb(localId, currentUserId)` / `dbToLocal(row)`).
2. Wire Finance page (`app/finance/page.tsx`, 866 lines) — highest value,
   most complex, proves the pattern. Replace each `useLocalStorage` with a
   Supabase fetch-on-mount + the existing setState calls also firing a
   Supabase insert/update/delete (keep it optimistic — don't add global
   loading spinners that regress the UX just fixed last session). Tables:
   `finance_accounts` (has new `account_kind` column), `finance_cards`,
   `finance_card_spends`, `finance_loans`, `finance_subscriptions`,
   `finance_payment_schemes`, `finance_payment_scheme_items` — all live.
3. Health page (`app/health/page.tsx`, 450 lines) — schema already has
   clean 1:1 tables (`health_records`, `health_appointments`,
   `health_log_notes`), simpler than Finance, same owner-map pattern.
4. Business page (`app/business/page.tsx`, 243 lines) — `business_projects`,
   `business_accounts`, `business_ideas` already exist and match.
5. Vision board (`components/VisionBoard.tsx`, 271 lines) — `board_items`
   table + `board-images` storage bucket both exist; photos currently stored
   as data-URLs in localStorage (5-10MB cap) need to become real uploads to
   the bucket with signed URLs, which is more than a find-replace — budget
   more time for this one.
6. Build-verify (isolated `/tmp` copy) → push (needs a fresh GitHub token
   pasted into chat, nothing persisted by design) → verify live in-browser.

**Login credentials for testing:** Shenaal = hilaryuae@gmail.com, Shalini =
shalunayanthara@gmail.com. The shared 6-digit passcode is intentionally not
written anywhere in this repo — ask the user if you need it, never commit it.

## SUPABASE SCHEMA IS NOW LIVE (fixed 2026-08-15)
Project `pfchzkcteymiigsdokeo`. All 17 Hari-CRM tables created via
`apply_migration` (the earlier "denied by safety classifier" issue did not
recur — it applied clean on retry). `profiles` RLS was missed by the
generic `install_household_rls` helper (different shape, no `visibility`
column) — fixed in a second migration with its own select/insert/update
policies (household members can see each other, only self can
insert/update). Also hardened `is_household_member()` and
`check_login_allowed()`: pinned `search_path`, revoked anon execute.
Storage buckets `health-documents` and `board-images` created (private).
`.env.local` already had the correct URL + anon key pointed at this
project — no changes needed there.

Remaining advisor notices are all pre-existing/unrelated: `users`,
`staff`, `rota` tables (leftover from an earlier prototype, not part of
this schema, INFO-level "RLS enabled no policy") — safe to ignore or drop
if confirmed unused, user's call.

**Next up (not started yet):** wire real Supabase queries into
Finance/Health/Business/Vision (all still localStorage-only right now —
schema exists but nothing reads/writes to it), then re-enable login
(`middleware.ts` — swap back from temporary root-redirect-only body to
`_disabledAuthMiddleware`). This is the actual cross-device-sync work and
is a substantial coding task — do it as its own session.

## Status: PUSHED & LIVE (auto-deploy) — commit `3bd2cdc`

## What shipped this session (all build-verified + confirmed live in-browser)
1. **Blank-screen bug** (`6278b41`) — CSP `script-src 'self'` (no `unsafe-inline`)
   silently blocked Next.js's inline hydration scripts. No console error, all
   chunks 200 — looked like a working deploy but React never attached.
   Diagnostic method saved in memory as `feedback_csp_blank_screen`: check
   for a `__reactFiber$*` key on the root DOM node — absent means hydration
   never ran, go straight to CSP. Fix: `'unsafe-inline'` added to
   `script-src`. **TODO: swap to a per-request nonce once real auth exists**
   (blanket `unsafe-inline` is a stopgap, not final security posture).
2. **Finance page fully rebuilt** (`d33a8d5`, `1824aa5`, `4dd04b9`, `3bd2cdc`)
   — see detailed breakdown below. This is the biggest single module now in
   the app and the pattern (per-user filter, edit-in-place, blur toggle,
   labeled fields) should be the template for Health/Business/Vision when
   those get their next pass.

## Finance page — final state
- `lib/financeUtils.ts`: EMI (reducing-balance formula), amortized
  remaining-balance, monthly-date helpers, red/orange/green/blue
  budget-status algorithm.
- Per-user filter tabs (Household/each member/Shared) across every section.
- **Everything is editable** — Accounts, Cards, Loans, Subscriptions, and
  Payment Schemes each have a pencil icon that swaps the row for an inline
  form pre-filled with current values (Save/Cancel). This was flagged
  directly by the user (`subscriptions can only be cancelled... values
  can't be changed`) — fixed across all five entity types, not just the one
  reported.
- Edit-mode fields have **persistent micro-labels**, not just placeholder
  text — placeholder text disappears the instant a field has a bound value
  (even `0`), which made the Card edit form unreadable (five blank "0"s in
  a row, user caught this with a screenshot). Lesson applied everywhere,
  not patched narrowly — see `feedback_...` note below.
- **Global blur toggle** (header, "Balances hidden/visible") replaces the
  old broken per-new-account checkbox that only affected accounts created
  after checking it. Now blurs every account balance including Joint
  savings, plus new per-currency account totals; click any individual
  amount to reveal just that one while the rest stay hidden.
- **Cards**: Visa/Mastercard tiles (last-4 only), expandable detail
  (limit/used/outstanding/APR), auto EMI when on a payment plan, per-card
  spend log with its own currency selector (previously always assumed the
  card's currency).
- **Loans**: bank/person/institution lender type, EMI + amortized
  remaining balance computed from principal/rate/tenure/start-date.
- **Payment schemes** (new): for plans that don't fit Loans (fixed EMI) or
  Subscriptions (single cadence) — e.g. a university programme with a
  termly fee + monthly materials + one-off exam fees, each its own line
  item with its own cadence (one-time/monthly/termly/yearly) and a
  paid/unpaid toggle for non-monthly items. Feeds into upcoming-payments,
  next-major-payment, and the monthly-outflow total.
- **Upcoming payments** (14-day window, merges subs+loans+scheme items)
  and **next major payment** (yearly/termly items landing 2–4 months out)
  widgets, both on the Finance page.
- Storage keys are versioned (`.v3` for accounts/cards/cardSpends, `.v2` for
  loans/subs) — each shape change got a new key rather than migration
  logic, since it's all local placeholder data pending Supabase anyway. If
  you change these shapes again, bump the key again.

## Lesson from this session (saved to memory as `feedback_finance_editability`)
User feedback: *"think an extra step when a feature is built on why it's
built, and how it can be refined."* Two patterns to actively watch for on
every future module, not just when reported:
1. **"Add" without "Edit" is half a feature.** Every entity list needs
   create + edit + delete from day one, not delete-and-recreate.
2. **Placeholder-only labels break the moment a field has a real value.**
   Any input that starts pre-filled (edit forms, especially) needs a
   persistent label, not just a placeholder attribute.

## NOT done yet — next session, IN THIS ORDER (user explicitly re-prioritized 2026-08-15)

1. ~~Fix the Supabase schema migration blocker~~ **DONE 2026-08-15** — see
   top of this file. Schema + buckets are live. Remaining: wire real
   Supabase queries into Finance/Health/Business/Vision (all currently
   localStorage-only), then re-enable login (`middleware.ts` — swap back
   from the temporary root-redirect-only body to `_disabledAuthMiddleware`).
   This unblocks cross-device sync, which is the actual point of the app.

2. **Dashboard "Quick add" button does nothing** — no handler wired up at
   all, just a static button. Needs a defined target (quick-entry for an
   expense/appointment/task?) — clarify scope with user, or pick a sensible
   default (probably a small modal with quick links into each module's add
   form) if not specified.

3. **Quick Launch customization** — currently hardcoded to
   ShelfPulse/RetailSuite only. User wants to choose what appears there,
   managed from Settings (add/remove, and reference a specific Business
   project as a shortcut target — see #5).

4. **New consolidated "Upcoming" dashboard widget** — merge Payments (from
   Finance: subs/loans/scheme items — reuse the exact logic already built
   for the Finance page's upcoming-payments widget), Renewals (insurance
   renewal dates from Health, subscription/scheme renewals from Finance),
   Appointments (from Health), and Reminders into **one** widget titled
   something like "Upcoming (Renewals, Appointments, Payments & Reminders)"
   — user was explicit this should be a single unified widget, not
   separate ones per category.

5. **Business page: make project cards editable** (currently static/fixed
   entries per HANDOVER's earlier business-page work) — add/edit/remove
   business projects. Once editable, Quick Launch (#3) should be able to
   point at a specific business project as one of its shortcut options.

6. Existing backlog (still after the above): Vision board
   trips/bucket-list/experiences, Memberships module — see prior session
   notes below for full spec.

## Notes for next session
- GitHub push needs a fresh token pasted into chat each session — nothing
  persisted (by design).
- Working git workflow: clone fresh to `/tmp/hari-crm-push-$(date +%s)`
  with the token, copy in edited files from a separately-verified build
  dir, commit, push from the clean clone. Don't fight the workspace
  folder's `.git` (Windows/mount permission issues recur every session).
- Always `npm run build` in an isolated `/tmp` rsync copy before pushing —
  every commit this session was build-verified clean (0 errors) first.
- Always verify live in-browser after deploy — this session caught a real
  NaN bug (stale localStorage key collision) that a clean build alone
  would not have caught. `get_page_text` + `javascript_tool` (dispatching
  real `.click()` calls on found DOM elements, not pixel coordinates —
  computer-use pixel clicks were unreliable this session, viewport
  reported 0x0) is the reliable verification path.

---

## Prior session notes (2026-08-14, household/PIN + Health + Business + Vision editor)
See git history for full detail — commits `ac1aba6`, `0541669`, `6dc5377`,
`636e528` shipped: household/PIN profile gate, Health page restructure
(conditions/appointments/insurance), Business page link fixes + program
stack tracker, full Vision board editor (photos/sticky notes/drag/resize),
Settings appearance + household management. All still localStorage-only.
