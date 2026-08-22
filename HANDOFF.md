# HANDOFF.md

**This file is the baton, not a log.** It gets overwritten every session/handoff — it should
always reflect only the current moment. For the full append-only history, see
`PROJECT-STATUS.md`. For standing rules and paths, see `AGENTS.md` (read that first, always).

Last touched: 2026-08-22, by Claude Cowork (documentation/handover-setup session, no code
changed).

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

**Nothing code-wise this session** — this was a documentation-only session that created
`AGENTS.md` (rewritten from its prior unfilled template), this file, and `MAINTENANCE.md`,
and backfilled `PROJECT-STATUS.md` for the 3 prior sessions that hadn't been logged there.

**Last real code shipped, for context:** commit `75656e4` ("r33af3a3e222" — an unhelpfully
generic commit message, not a typo in this doc), pushed 2026-08-20, confirmed via `git log`/
`git status` this session that the real working tree **is up to date with `origin/main`** —
the earlier "several commits stuck locally, git push blocked" situation described in
Claude Cowork's private memory is **resolved**; Coco has since pushed via GitHub Desktop.
That commit contains: the Quick Add launcher, admin backup restore flow, real (not
hardcoded) Dashboard spending-trend/category-split widgets, the Email-reminders toggle
wired to a real backend, global Cmd+K search, the new `/fitness` page (BMI calculator, body
measurements log, cycle tracker) with 2 new Supabase tables, and the Resend-based alerts
API route.

**Not verified this session:** whether Render's auto-deploy actually picked up `75656e4` and
the live site reflects it. Nobody has checked `hari-crm.onrender.com` against this commit.
**First concrete task for whoever picks this up:** load the live site and spot-check the new
features (fitness page, Cmd+K search, Dashboard widgets) are actually live, not just built.

## What's queued next

In priority order (full detail and the complete checklist in `BACKLOG.md`):

1. **Confirm the live deploy** (see above) — 5-minute check, do this first.
2. **Resend/email-alerts external setup** — parked, needs Coco to buy a domain first (he
   asked to be reminded periodically, not asked to build anything more). Once he has one:
   verify domain in Resend, set 3 Render env vars (`RESEND_API_KEY`, `ALERTS_FROM_EMAIL`,
   `ALERTS_CRON_SECRET`), wire a free external cron (e.g. cron-job.org) to
   `/api/alerts/notify?secret=...`. Code is already written and build-verified — this is
   pure external configuration, not a coding task.
3. **`schema.sql` is out of date** — confirmed this session it's missing the `households`
   base table definition and at least `calendar_events`, `finance_expenses`,
   `finance_payment_schemes` entirely (see `AGENTS.md` §5). Whoever next does schema work
   should regenerate or manually reconcile `schema.sql` against the live Supabase schema so
   it stops silently drifting.
4. **Phase 1 — RLS penetration audit** (method fully documented in `BACKLOG.md`) — still not
   done. Matters for cross-household-member privacy even though no bank data is stored.
5. **Phase 2 remaining items** — wearable health sync (no free direct-browser path found,
   needs a companion app or paid aggregator), configurable Dashboard widgets, calendar
   recurring-bill full projection (currently shows only the next occurrence), pinnable
   watchlists, document vault (blocked behind the RLS audit above), moving the ENBD credit
   card into `finance_cards` (blocked on Coco supplying real limit/outstanding figures).
6. **Line-ending noise (~56 files)** — harmless CRLF/LF drift, documented in `AGENTS.md` §7/
   `MAINTENANCE.md`. Not urgent, but a `.gitattributes` fix would make `git status` legible
   again.

## Assigned specifically to Antigravity (not to be done by Claude Cowork)

None outstanding right now. When Coco hands a task explicitly meant for Antigravity, record
it here in full — enough context that Antigravity doesn't need him to repeat it — even if
Claude Cowork could technically do it itself.

## Standing notes

- Claude Cowork's cloud sandbox still cannot push to this repo directly (git proxy blocks it
  outright, confirmed across multiple sessions/tokens) — its workaround is delivering files
  to Coco's machine for him to commit via GitHub Desktop. This is a structural limitation of
  its sandbox, not a bug to fix.
- Antigravity, by contrast, has persistent local git auth on Coco's machine and should be
  able to commit and push directly — first Antigravity session here should confirm this
  actually works and note the result here.
- No `.env.local` exists in the real working tree right now — needed for local `npm run dev`
  and not needed for anything this session. See `AGENTS.md` §8 for how to source real values.
- The stale outer duplicate folder (`AGENTS.md` §3) still exists on disk — not cleaned up
  this session since deleting files wasn't in scope for a docs-only task. Safe to leave
  alone; just never write to it.
