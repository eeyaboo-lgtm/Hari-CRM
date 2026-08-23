# HANDOFF.md

**This file is the baton, not a log.** It gets overwritten every session/handoff — it should
always reflect only the current moment. For the full append-only history, see
`PROJECT-STATUS.md`. For standing rules and paths, see `AGENTS.md` (read that first, always).

Last touched: 2026-08-23, by Claude Cowork (bug fix + Business Projects/Dashboard rework +
new Savings Goals feature — code delivered to Coco's machine, NOT yet committed/pushed by him).

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

## What was just shipped

**Code delivered to Coco's machine this session (2026-08-23) — build-verified (`tsc --noEmit`
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

1. **Coco reviews and pushes the delivered files** via GitHub Desktop — nothing above is live
   until then. First live check afterward: Dashboard tiles, Business Projects pin toggle,
   Finance's new Savings Goal section, all under his own account and (if he can arrange it)
   a second test account in a different household.
2. **Two orphan-account manual deletions** (see above) — needs Coco, then a same-session or
   next-session Claude Cowork/Antigravity cleans up the leftover `households` rows.
3. **Link the Google account** — Coco signs in as Shenaal, clicks the new button in Settings.
4. **Resend/email-alerts external setup** — still parked, needs Coco to buy a domain first.
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
