# MAINTENANCE.md

Hand-maintained, periodically-stale content in this project — things nobody automatically
keeps current, so they need a deliberate re-check on a schedule. If something here turns out
to have drifted, fix it and log it in the re-check log at the bottom rather than just
silently fixing it.

## What needs re-checking

### `schema.sql` vs. the live Supabase schema
**Confirmed drifted as of 2026-08-22** — the file is missing the `households` base table
entirely (only has an `alter table households ...` line) and at least `calendar_events`,
`finance_expenses`, `finance_payment_schemes`. Likely also missing whatever backs the
Memberships page. **Re-check:** before any migration or schema-touching work, and at least
once a quarter regardless. **How:** compare `schema.sql`'s `create table` list against
Supabase's `list_tables` (or `information_schema.tables`) for project `pfchzkcteymiigsdokeo`
and reconcile.

### Resend email alerts — external setup
Code is done and build-verified (`app/api/alerts/notify/route.ts`, `lib/resend.ts`). Needs,
in order: Coco buys and verifies a domain in Resend, 3 Render env vars get set
(`RESEND_API_KEY`, `ALERTS_FROM_EMAIL`, `ALERTS_CRON_SECRET`), and a free external cron
(e.g. cron-job.org) gets pointed at the notify endpoint. **Re-check:** whenever Coco mentions
buying a domain, or periodically ask if he has one yet — he's explicitly asked to be reminded
rather than let this drop.

### `fx_rates` table — manually seeded currency conversion
LKR/AED/USD rates were seeded once from a real snapshot, not pulled from a live feed. They
will drift from actual market rates over time and the Spending Plan/finance projections use
them. **Re-check:** monthly, or before treating any finance projection as precise enough to
make a real decision on. **How:** re-check current rates and update `fx_rates` via SQL, or
build a real live-rate integration (Frankfurter.app was identified as a free, no-key option
in an earlier suggestions pass — not built).

### Legal pages (`app/legal/*`) — not lawyer-reviewed
Written fresh for this app's real data model but explicitly not reviewed by a lawyer. Fine
as-is for friends/family testing. **Re-check:** before this ever moves toward a public or
commercial launch (ties to the Phase 3 business-model backlog) — get an actual legal review
at that point, don't keep deferring past that milestone.

### Google OAuth "Confirm email" toggle
Supabase Authentication → Providers → Email → "Confirm email" needs to stay ON so new
signups verify their email before a household becomes usable. No MCP/API tool can check or
set this — dashboard-only. **Re-check:** any time auth/signup flow is touched, since there's
no automated way to catch it silently flipping off.

### Line-ending (CRLF/LF) noise on ~56 files
`core.autocrlf`/`core.eol` are unset in this repo, so the Windows working tree keeps
flip-flopping line endings against what's committed — currently shows as ~56 "modified"
files that are actually no-op diffs. Harmless but makes `git status`/`git diff` noisy and
risks an accidental blind-stage. **Re-check:** if the noisy-file count keeps growing, or
just fix it properly with a `.gitattributes` (`* text=auto eol=lf`) the next time someone's
already touching repo config — not urgent enough to interrupt other work for.

### `LifeOS-Billion-Dollar-Strategy.md` / `HARI-CRM-SUGGESTIONS-2026-08-19.md`
Point-in-time strategy/ideas docs, not living documents — they'll read as dated once several
of their suggestions ship or get explicitly rejected. **Re-check:** whenever `BACKLOG.md`'s
"Explicitly NOT queued" section changes, or every few months, sweep these two docs for
suggestions that have since shipped (move to done) or been superseded (mark stale) so they
don't mislead a future session into re-proposing something already decided.

## Re-check log

| Date | What was checked | Result |
|---|---|---|
| 2026-08-22 | `schema.sql` vs. live app code references | Confirmed drifted — see entry above. Not yet reconciled against live Supabase (that's the next step, not done this session). |
| 2026-08-22 | Local working tree `.env.local` presence | Confirmed absent from the real (inner) working tree — see `AGENTS.md` §8. |
| 2026-08-22 | Git push path (Claude Cowork sandbox → GitHub) | Confirmed still proxy-blocked for Claude Cowork; confirmed Coco's own GitHub Desktop push path works — repo is up to date with `origin/main` as of commit `75656e4`. |
