# Hari-CRM — Session Handover (2026-08-14, mega feature-request session)

## Status: code written, NOT YET built/pushed/deployed
Session hit usage limit mid-build-verify. Code below is written to the local
workspace files but has **not** been through `npm run build` and has **not**
been pushed to GitHub or deployed. Next session: verify build, then push.

## What was actually built this session
User gave a 6-part mega feature request (household/PIN splitting, Health
restructure, Finance rebuild, Business additions, Vision trips/experiences,
Memberships module). Given the scope, built in priority order:

1. **Household/Profile/PIN infrastructure (DONE)** — foundational, shared by
   Health/Finance/Vision:
   - `lib/HouseholdContext.tsx` (new) — React context, `HouseholdProvider` +
     `useHousehold()` hook. Members list in localStorage (`household.members`),
     active profile + unlock state in sessionStorage (re-pick each browser
     session, Netflix-style). PINs are SHA-256 hashed via SubtleCrypto, never
     stored plain. Functions: selectMember, attemptUnlock, lock, addMember,
     removeMember, renameMember, setPin, changePin, removePin.
   - `components/ProfileGate.tsx` (new) — full-screen profile picker + 6-digit
     PIN pad, wraps the whole app via `app/layout.tsx`. Skips itself on
     `/login`. Renders nothing until a profile is picked and unlocked.
   - `app/layout.tsx` edited — wraps `{children}` in `<HouseholdProvider><ProfileGate>`.
   - `components/TopBar.tsx` rewritten — real members from context instead of
     hardcoded PEOPLE array; clicking another avatar re-triggers the PIN gate
     if that member has one set.
   - `app/settings/page.tsx` edited — "Household profiles" section now has
     real add/remove member, rename, and a `PinManager` sub-component per
     member (set/change/remove 6-digit PIN, requires current PIN to change/remove).

2. **Health page restructure (DONE)** — `app/health/page.tsx` fully rewritten:
   - **Conditions & history** — member dropdown selector + text + optional date.
   - **Appointment history** — member dropdown selector + text + provider +
     date, sorted by date.
   - **Insurance details** — separate section, multiple policies supported.
     Each policy card: household member, provider, key policyholder (free
     text, e.g. "under spouse's plan"), expiry date, renewal date, co-payments/
     allowances/coverage notes (free text), and 4 file upload slots (card
     front, card back, coverage network file, benefits table) — each stored
     as a data URL (`FileReader.readAsDataURL`, same pattern as
     `VisionBoard.tsx`'s photos), with "open in new tab" and "download" links
     once uploaded, plus a remove button. Noted in-page: large files should
     wait for the `health-documents` Supabase bucket (already planned in
     schema.sql, not yet wired) — data-URL approach has the same ~5-10MB
     browser cap already flagged for vision board photos.

3. **Business page quick wins (DONE)** — `app/business/page.tsx` rewritten:
   - Fixed project cards: **UnwindCircle** (https://unwindcircle.com/) and
     **Dino History** (https://dinohistory.com/, was previously pointing at a
     wrong `dinohistory.onrender.com` placeholder) added/corrected alongside
     ShelfPulse/RetailSuite.
   - **Idea journal "not saving" bug** — root cause wasn't conclusively found
     (the original `useLocalStorage` hook looked correct on inspection), but
     hardened defensively: the idea-input textbox itself is now
     localStorage-backed (`business.ideaDraft`) so every keystroke persists
     immediately, not just on "Add" — nothing typed can be lost even if the
     tab closes first. Worth watching next session whether the user still
     sees ideas vanish after this.
   - **New: Program stack section** — add entries for Render/GitHub/Supabase/
     Cloudflare/Spaceship.com (preset dropdown) or "Other", each with a
     clickable shortcut link (editable to a custom URL, e.g. a specific
     repo), and email/username fields masked with a `***` tail
     (`maskTail()` helper) until toggled to reveal.

## What's NOT done yet (next session, in priority order)
1. **Verify the build** — run `npm run build` in a clean `/tmp` clone (the
   workspace `.git` corruption issue is recurring again, see below), fix any
   type errors, THEN push to GitHub. Nothing above has been deployed.
2. **Finance page rebuild** (biggest remaining piece) — per-user split with
   combined household view; blur/unblur salary (click to reveal, click again
   to reblur); banks + cards (Visa/Mastercard tiles, last-4-digits only,
   account type incl. BNPL); card detail view with installment plans
   (interest rate, credit limit, limit used, tenure, outstanding, auto-
   calculated monthly EMI); loans (banks/people/institutions, university
   payment timelines showing cycle position); subscriptions (currency,
   provider, repayment date, tenure, tax) feeding a dashboard "upcoming
   payments within 2 weeks" widget and a Finance-page "this month + next
   major non-monthly payment in 2-4 months" view; per-card spending entries
   (description/date/amount/currency); and the budget-status color algorithm
   (red/orange/green/blue) feeding the dashboard.
3. **Vision board additions** — trips/bucket-list/experiences with type and
   ticket price/links; trip detail page (one-way/round-trip/per-person costs,
   notes, shortcuts to MakeMyTrip/Expedia/Booking.com/Trivago/Agoda/
   TripAdvisor/Airbnb + 4 more); experience shortcuts by region (UAE:
   Platinumlist/Cobone/Groupon/Fever; equivalents for US and Sri Lanka —
   needs a quick web search next session for the right regional sites).
4. **Memberships module** — new dashboard bottom-button + page, distinct from
   Subscriptions (renewal/expiry/fees/payment dates, can include loyalty
   cards).
5. Update `schema.sql` to add tables matching all of the above once the
   Supabase migration blocker (see PROJECT-STATUS.md — project needed
   renaming away from "RetailSuite Project") is resolved, so this doesn't
   stay localStorage-only forever.

## Recurring environment issue (again this session)
Workspace folder's `.git` broke again (`rm: cannot remove ... Operation not
permitted` even on `/tmp` paths this time — broader FS hiccup, not just
`.git`). Standard workaround from prior sessions: rsync the project
(excluding `.git`/`node_modules`/`.next`) into a fresh `/tmp` dir, `git init`
+ remote there, build/test, then push from `/tmp`. If `/tmp` itself is
locked, try a differently-named temp dir or retry after a moment — this has
been transient before.

## Reminder
Per project instructions: this session is past the message threshold — start
a **new Cowork session** in this same project. Everything needed to continue
is in this file plus memory (`project_hari_crm.md`).
