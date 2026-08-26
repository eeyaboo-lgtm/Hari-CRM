# HANDOFF.md

**This file is the baton, not a log.** It gets overwritten every session/handoff — it should
always reflect only the current moment. For the full append-only history, see
`PROJECT-STATUS.md`. For standing rules and paths, see `AGENTS.md` (read that first, always).

Last touched: 2026-08-26, by Claude Cowork (found and fixed the REAL root cause of the allergy
save bug — the 2026-08-23 fix was real but incomplete — plus invite-code discoverability and
two light-mode CSS bugs). **Confirmed via `git fetch`+`git log` and Render's deploy API that
Coco has been pushing promptly this time** — commit `1acea24` ("Summary updates", contains the
2026-08-25 mobile nav work and everything before it) was live on Render before this session
started. Today's changes are delivered to Coco's machine but not yet committed/pushed by him —
check `git status`/`git fetch` fresh next session rather than assuming either way.

## What was just shipped (this session, 2026-08-26)

**Three things reported, all fixed:**

1. **Health allergy entries still not saving, even after the 2026-08-23 fix.** This time
   confirmed the fix WAS live (Render `list_deploys` showed commit `bc9945b` "Fixes" — the
   commit containing that rewrite — status `live`), and confirmed via Supabase
   (`health_allergies` had 1 row, not 3) that entries really were being lost, not just delayed.
   Found the real bug by reading `useSupabaseSynced.ts`'s own gate logic: `setValue` skips the
   Supabase write entirely (no queueSync call, no pending-id tracking — nothing) while `ready`
   is still false, i.e. during the window between mount and the initial fetch resolving. That
   window is real on a phone with a slower connection — long enough to fill in and submit a
   form. Since no write was ever attempted, the 2026-08-23 self-heal recovery (which only knows
   about writes that reached `sync()` and failed) had nothing to find either — the edit was
   just gone. Fixed in both `lib/supabase/useSupabaseSynced.ts` and
   `lib/supabase/useSchemesSynced.ts` (same bug shape) via a `pendingWriteRef`: an edit made in
   that window is now recorded and synced against the real server baseline the moment the
   initial load finishes, instead of being dropped. `useSavingsGoal.ts` checked and confirmed
   NOT affected (it's action-based, awaits each Supabase call directly, no such gate).
2. **"Invite with code generates a code but where does a person paste it?"** Traced it: `/join`
   already existed and worked fine (code entry + Google/email signup), but neither `/login` nor
   `/signup` linked to it or mentioned it anywhere — someone who got just the bare code (read
   aloud, texted) had no way to find it. Added a "Have an invite code? Join a household" link to
   both pages, and reworded `HouseholdInvites.tsx`'s helper text to mention both paths.
3. **Light mode bugs — "vertical black bar on the right corner" + "text boxes stuck with black
   text and dark boxes."** Found and fixed a concrete one: `DatePicker.tsx`'s Day/Month/Year
   controls keep a fixed dark-navy background in both themes on purpose (per the original
   request), but the site's light-theme CSS force-overrides ANY `text-white` element to dark
   text — so in light mode, all 30 date-picker instances across the app went dark-text-on-dark-
   background, invisible. Fixed with a `dp-select` marker class + a higher-specificity override
   that pins DatePicker's text to white regardless of theme. Also added `overflow-x: hidden` to
   `html, body` as a defensive fix for the "black bar" (the standard cure for a stray few-pixel
   horizontal overflow revealing whatever's behind the page on mobile) — **not confirmed as the
   actual cause, no live browser/screenshot available this session.** If it's still there after
   this deploys, it needs an actual phone screenshot to pin down.

**Verification:** every file checked with a Babel parser (syntax only) — no `tsc`/`next build`,
no live browser check. Full detail: `project_hari_second_allergy_bug_and_invite_ui.md` in
memory.

---

## What was shipped 2026-08-25

**Trigger:** Coco reported "the mobile web version is lacking menu navigation." Confirmed by
reading the code: `components/Sidebar.tsx` is `hidden md:flex` — invisible below the `md`
breakpoint — and `components/MobileBackButton.tsx` only replays browser history one step back
(and is itself hidden on Dashboard/login/root). `GlobalSearch` (Cmd+K) has no visible touch
trigger. Net effect: a phone user had no way off whatever page they landed on.

**Fix (3 files changed, 1 new, verified only with a Babel parser for syntax — no `tsc`/`next
build` this session, no node_modules available):**
- `lib/navItems.ts` (new) — the section list (label/icon/href) that used to live inline in
  `Sidebar.tsx`, pulled out so desktop Sidebar and the new mobile drawer read from one shared
  source and can't drift apart as pages are added.
- `components/Sidebar.tsx` — now imports from `lib/navItems.ts` instead of defining the list
  inline. No visual/behavior change on desktop.
- `components/MobileNav.tsx` (new) — hamburger button + full-screen slide-out drawer, same 9
  sections + Log out, styled to match Sidebar. Positioned `fixed bottom-4 left-3` (NOT the more
  conventional top-right) because every other corner was already taken: MobileBackButton owns
  top-left; Dashboard's `TopBar` (only used on `/dashboard`) has a bell + avatar cluster that
  reaches top-right on mobile; GlobalSearch's own trigger and SaveStatusIndicator both already
  live bottom-right.
- `app/layout.tsx` — mounted `<MobileNav />` inside `<ProfileGate>`, next to `<GlobalSearch />`,
  so it only shows once a household/profile is unlocked.

**Not verified:** no live phone/browser check this session (no deployed build to test against
— nothing is pushed yet). First thing to check once Coco pushes: open on an actual phone,
confirm the hamburger appears bottom-left, the drawer opens/closes cleanly, and nothing
overlaps Dashboard's bell/avatar row. Full detail: `project_hari_mobile_nav.md` in memory.

---

## Previously shipped (2026-08-23 sessions) — STILL queued for Coco to push, unchanged this session

---

## Paste this to start any new Antigravity session on this project

```
You're picking up work on Hari-CRM, a household life dashboard (health, multi-currency
finance, business-project tracking, calendar, fitness) built for a two-person household,
in Next.js + TypeScript + Supabase, deployed on Render.

Before doing anything else:
1. Read AGENTS.md in this repo root, in full. It covers role hierarchy, repo paths (there
   are TWO similarly-named local folders — AGENTS.md section 3 tells you which one is the
   real git working tree; open that one, not the other), tech stack, the current data/schema
   snapshot, operating rules, git discipline, credential/access patterns, and known gotchas.
2. Then read this file (HANDOFF.md) in full — it's the current baton: what was just shipped,
   what's queued next, and any standing notes.
3. Then check BACKLOG.md for the full roadmap queue.

Handoff discipline you must follow:
- HANDOFF.md is a baton — overwrite it when you're done with your session, don't append to
  it. PROJECT-STATUS.md is the log — append a new dated section there, never overwrite it.
- Anything you learn that a future session (yours, Antigravity's, or Claude Cowork's) would
  need to know must go into one of these committed files. Claude Cowork cannot read your
  memory or session history, and you can't read its private memory either — the files are
  the only shared truth between us.
- Do not assume you know the current state of this project from training data or from your
  own memory of a prior session here. Always re-check live files and the live database before
  acting — this project changes across sessions from both agents, and stale assumptions have
  caused real bugs before (see AGENTS.md's gotchas section).
- Credentials/env vars: you have your own persistent local git auth and can read this
  machine's files directly — use those rather than asking the user to paste anything you can
  already reach. Real Supabase/Render values live in the Render dashboard's environment
  variables (source of truth) — there is currently no .env.local in the real working tree,
  see AGENTS.md section 8 for how to get one if you need to run this locally.
- Neither of us changes scope, monetization direction, or deletes data without asking the
  user first.

Before you finish this session, update this file (HANDOFF.md) — overwrite it, don't append —
with what you shipped, its verification status, and what should happen next.
```

---

## What was just shipped (this session, 2026-08-23, later in the day)

**Code delivered to Coco's machine — verified only with a Babel parser (JSX+TS plugins) for
syntax validity, NOT a full `tsc`/`next build`** (no node_modules/full repo available
in-session) **and NOT YET committed/pushed.** Full detail:
[[project_hari_data_loss_and_ux_audit]] in memory. Summary:

1. **Data-loss root-cause fix.** User reported adding 3 allergy entries, refreshing, and losing
   them all. Root cause: `lib/supabase/useSupabaseSynced.ts` (shared by nearly every CRUD
   module) fired Supabase writes without awaiting/queueing them and with no protection against
   navigating away mid-write. Fixed with a write-queue + self-healing recovery-on-mount +
   a new shared status store `lib/supabase/syncStatus.ts` (also wired into `useSchemesSynced.ts`
   and `useSavingsGoal.ts`) + a global `<SaveStatusIndicator />` (mounted in `app/layout.tsx`)
   that shows "Saving…" / "Couldn't save N changes" so failures are never silently invisible
   again. **Not yet confirmed by Coco that the original symptom is actually gone.**
2. **New themed `DatePicker` component** (`components/DatePicker.tsx`) replacing every raw
   `<input type="date">` (30 occurrences across `finance`, `health`, `fitness`, `memberships`
   pages) — fixes the native control's broken year-typing and gives a dark-blue/white,
   handheld-friendly dropdown instead of an unstylable OS calendar popup.
3. **Add-row label audit extended app-wide** (previously Finance-only, see
   [[project_hari_finance_ux_labels]]). Found and fixed the same "edit row has labels, add row
   doesn't" anti-pattern in `app/health/page.tsx` (Conditions, Appointments — had zero labels),
   `app/fitness/page.tsx` (Measurements, Cycle Tracker), and `app/business/page.tsx` (project
   add/edit forms). Checked and already-compliant: Calendar, Settings, Vision pages,
   Memberships.
4. **New standing rule** — "Form & Data-Entry Standards" section added to `CLAUDE.md` (between
   Coding Standards and Architecture Standards) + a restating bullet in `AGENTS.md` §6 so
   Antigravity picks it up too: no unlabeled add-rows, one-line hover hints on ambiguous
   fields, always use `DatePicker`, every new Supabase-sync hook must wire into
   `syncStatus.ts`. This is meant to stop the above two categories of bug from recurring.

---

## Previously shipped (earlier 2026-08-23 session) — STILL queued for Coco to push

**Code delivered to Coco's machine — build-verified (`tsc --noEmit`
clean, `npm run build` succeeds, all 28 routes compile) but NOT YET committed/pushed.** Coco
needs to review and push via GitHub Desktop for any of this to reach the live site.

1. **Security fix — proprietary business links were showing on every account.**
   `lib/quickLaunch.ts`'s hardcoded default (ShelfPulse/RetailSuite) was shown to every
   signed-in account on any fresh browser via localStorage — a friend logging in on his own
   Google account saw Shenaal's private business links. Root cause confirmed via live DB
   query: `business_projects` was actually EMPTY for every household (the old
   `DEFAULT_PROJECTS` seed array was client-side-only, never durably saved) — this is also
   why Hilary's own 4 projects (ShelfPulse/RetailSuite/UnwindCircle/DinoHistory) had silently
   "disappeared": nothing was ever deleted, they just never existed as real rows.
2. **Architecture change — Dashboard shortcuts now come from Business Projects, not a
   separate localStorage system.** New `pinned_dashboard boolean` column on
   `business_projects` (migration applied live). The Business Projects page
   (`app/business/page.tsx`) is now the single place to add/edit a shortcut (name, URL,
   optional description capped at 140 chars via `NOTES_MAX_LEN`) and pin/unpin it to the
   Dashboard via a pin icon per card; the description never shows on the Dashboard tile,
   only the name. New/empty households see a "beautifully designed" dashed-border "+" empty
   state on both pages instead of anyone else's data. `app/dashboard/page.tsx` now reads
   `business_projects` directly (`pinned_dashboard = true`), already correctly scoped per
   household via existing RLS — confirmed live via `pg_policies`, not assumed. The old
   Quick Launch section in Settings was removed entirely (`app/settings/page.tsx`) since
   it's fully superseded.
3. **New feature — Savings Goals**, per Coco's spec (one active goal per person, private by
   default with an optional household-shared toggle). New tables `finance_savings_goals` +
   `finance_savings_goal_logs` (migrations applied live, RLS confirmed correct — 'private'
   is owner-only even to other household members, 'shared_view' allows household-wide
   viewing but owner-only editing). Built as a bespoke hook
   (`lib/supabase/useSavingsGoal.ts`) rather than the shared `useSupabaseSynced`/
   `resolveOwner` pattern, because `resolveOwner()` can only ever emit `shared_view`/
   `mirrored_edit`, never true `private` — see the hook's own header comment for the full
   reasoning. On the Finance page: a horizontal gradient progress bar in Deep view
   (`SavingsGoalProgressBar` in `components/finance/FinanceDeepView.tsx`), a blurred
   "allocate this much this month" reveal under the Spending Plan banner (reuses the
   existing `BlurAmount` pattern), and a full Standard-view section to set the goal, edit
   it, log each month's actual amount saved, and see past months logged. New math helpers
   in `lib/financeUtils.ts`: `monthsUntilDate`, `computeSavingsPlan`, `firstOfMonthIso`.
4. **Auth identity fix (code side only)** — new "Link a Google account" button in Settings
   (`app/settings/page.tsx`, uses `supabase.auth.linkIdentity()`) so Coco can attach
   `hilarynonis@gmail.com`'s Google identity onto his real Shenaal account
   (`hilaryuae@gmail.com`) instead of it creating a separate, empty profile. **Not yet used
   — he needs to sign in as Shenaal and click it.** If it errors immediately, check Supabase
   Dashboard → Authentication → Providers → "Allow manual linking" is ON (dashboard-only
   setting, no MCP tool exposes it).
5. **Small fix** — `components/Sidebar.tsx`'s "Status check" card had a hardcoded
   "ShelfPulse & RetailSuite health" reference visible to every household; reworded to be
   generic.

**Blocked, needs Coco to act manually (not a coding task):** two confirmed-empty orphan
accounts (`hilarynonis@gmail.com`'s old separate login, `shalininonisdxb@gmail.com`) need
deleting via Supabase Dashboard → Authentication → Users — the equivalent SQL was blocked by
a platform safety classifier on deleting `auth.*` rows directly. Once Coco deletes them there
(their `profiles` rows cascade-delete automatically via FK), the two now-orphaned
`households` rows (`1af9b802-...`, `216c70ea-...`) still need cleanup — that part IS doable
via plain `execute_sql` (app table, not auth schema) by whoever picks this up next.

**Not verified this session:** the actual live UI (build passed, but nothing has been
manually clicked through in a browser — Coco has not pushed yet, so there's nothing live to
check against regardless).

## What's queued next

In priority order (full detail in `BACKLOG.md`):

0. **Coco pushes today's (2026-08-26) delivered files** — everything through the 2026-08-25
   mobile-nav session is CONFIRMED live (Render `list_deploys` shows commit `1acea24` status
   `live`, and `git fetch` shows 0 ahead/0 behind `origin/main` as of this session's start).
   Today's allergy-bug/invite-UX/light-mode fixes are the only thing still sitting on disk
   uncommitted. First live checks after pushing: (a) add a few Health entries and refresh
   quickly, ideally on mobile data rather than wifi, to actually exercise the race window the
   fix targets; (b) check the "Have an invite code?" link works from `/login` and `/signup`;
   (c) toggle light mode on a phone and check a date picker is readable and the black bar (if
   it was ever really there) is gone.
1. **Two orphan-account manual deletions** (Supabase Dashboard → Authentication → Users) —
   needs Coco, then a same-session or next-session Claude Cowork/Antigravity cleans up the
   leftover `households` rows via `execute_sql`.
2. **Link the Google account** — Coco signs in as Shenaal, clicks the button in Settings.
3. **Resend/email-alerts external setup** — still parked, needs Coco to buy a domain first.
5. **`schema.sql` is still out of date** — now also missing `finance_savings_goals`,
   `finance_savings_goal_logs`, and the `pinned_dashboard` column on `business_projects` on
   top of the gaps already noted in `AGENTS.md` §5.
6. **Phase 1 — RLS penetration audit** — still not done.
7. **Line-ending noise (~56 files)** — unchanged, still not urgent.

## Assigned specifically to Antigravity (not to be done by Claude Cowork)

None outstanding right now.

## Standing notes

- Claude Cowork's cloud sandbox still cannot push to this repo directly — its workaround is
  delivering files to Coco's machine for him to commit via GitHub Desktop. Confirmed again
  this session (all 9 changed/new files delivered via SendUserFile + written to disk via the
  device bridge, none committed).
- Antigravity has persistent local git auth on Coco's machine and should be able to commit
  and push directly — still not independently confirmed by an actual Antigravity session.
- No `.env.local` exists in the real working tree — this session's build verification used a
  full tarball snapshot of the real repo in an isolated scratch copy (not the real working
  tree) purely to confirm `tsc`/`npm run build` pass; no `.env.local` was needed for that.
- The stale outer duplicate folder (`AGENTS.md` §3) still exists on disk — left alone.
