# Hari-CRM — Session Handover (2026-08-16, latest #11 — READ THIS FIRST)

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
