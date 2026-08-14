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
