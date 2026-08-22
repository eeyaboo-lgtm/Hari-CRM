# AGENTS.md

Entry point for any AI tool working on this project — Claude Cowork, Google Antigravity,
Claude Code, or anything else. **Read this file first, every session, before touching code
or content.** Then read `HANDOFF.md` (current baton) and `BACKLOG.md` (roadmap queue).

---

## 1. Role hierarchy

- **Claude Cowork** is primary: architect, thinking partner, content/strategy work, and the
  default builder. Runs in a cloud sandbox with **zero persistent git auth** — every session
  starts fresh, cannot push to GitHub (see "Known operational gotchas"), and has no standing
  filesystem access except through a device bridge to Coco's machine.
- **Google Antigravity** is the secondary execution engine: steps in when Claude Cowork hits
  usage limits, or when Coco wants overnight/parallel progress. Runs locally on Coco's machine
  with **persistent local git auth** (already-authenticated GitHub Desktop / git credential
  manager) and direct filesystem access — it can commit and push directly, which Claude Cowork
  cannot do reliably.
- **Neither agent makes unilateral judgment calls** that change project scope, monetization
  direction, or delete data (including DB rows, files, or git history) — flag those to Coco
  first and wait for a decision. Both agents can and should make ordinary implementation
  judgment calls (which component to reuse, how to structure a query) without asking.

## 2. Project purpose

Hari-CRM is a household life dashboard for Shenaal (husband) and Shalini (wife): health &
insurance records, multi-currency finance (LKR/AED/USD), business project tracking
(quick-launch + health checks for ShelfPulse and RetailSuite), a shared vision/mood board,
a real shared calendar, and a growing fitness/wellness module. Every piece of data is
owner-scoped with a private/shared_view/mirrored_edit visibility flag so it works for a
multi-person household, not just one user. **Not currently for sale — personal
infrastructure first**, though `LifeOS-Billion-Dollar-Strategy.md` documents a real path to
a freemium product if that's ever pursued. Standing build philosophy (see `CLAUDE.md`):
simplest working solution, revenue-before-infrastructure, explain-why-before-code.

## 3. Repo & paths

- **GitHub:** https://github.com/eeyaboo-lgtm/Hari-CRM.git — branch `main`, auto-deploy on.
- **Live:** https://hari-crm.onrender.com — Render web service `srv-d9vkoo3m8hqs739jj5d0`,
  Free plan, Singapore region. (Verify plan/status in the Render dashboard before assuming —
  it's drifted from the form default before.)
- **Database:** Supabase project `pfchzkcteymiigsdokeo` (still internally named after a
  decommissioned earlier project — cosmetic only, don't let it cause confusion).

### The planning folder and the real git working tree are NOT the same folder — this has caused real confusion before

Coco's machine has **two folders that both look like "Hari-CRM"**, one level apart:

- **`...\Project Management Dashboard - Master\Hari-CRM\Hari-CRM\`** (inner, two
  `Hari-CRM`s in the path) — **this is the real git working tree.** It has a healthy `.git`
  with full history, a tracked `origin/main` remote, and is what GitHub Desktop actually
  commits and pushes from. **Antigravity should open this exact folder.** This is "repo
  root" everywhere else in this document.
- **`...\Project Management Dashboard - Master\Hari-CRM\`** (outer, one level up) — a stale,
  orphaned duplicate left over from a 2026-08-19 GitHub Desktop nested-clone mistake (Coco
  picked "Clone a repository" instead of "Add an Existing Repository" inside the already-
  cloned folder). It has its own `.git` but it's broken/incomplete (no real commit history)
  and is **not connected to GitHub in any way that matters**. It also holds old, out-of-date
  copies of every doc and source file. **Never write here. Never treat it as current.** If
  either agent ever finds itself reading stale-looking code or docs, check which of these two
  folders it's actually in before debugging further.

Both agents should always double-check they're in the **inner** folder (the one with a
working `origin/main` remote) before making any change.

## 4. Tech stack

- **Framework:** Next.js 14.2.15 (App Router) + TypeScript 5.6 + Tailwind 3.4
- **Backend:** Supabase (Postgres + Auth + Storage), project `pfchzkcteymiigsdokeo`
- **Hosting:** Render, Node web service, auto-deploy from `main`
- **Key libraries:** `@supabase/ssr` + `@supabase/supabase-js`, `recharts` (charts),
  `lucide-react` (icons), `zod` (validation) — no state-management library, no ORM (raw
  Supabase client calls throughout)
- **Email:** Resend (`lib/resend.ts`) — code is live but **not yet functional**, see
  `MAINTENANCE.md` (needs a purchased+verified domain, Render env vars, and an external cron)
- **Legacy:** `legacy-flask/` — the old Python/Flask version of this dashboard, archived,
  not deployed, not touched in active work
- **Local dev caveat:** the real working tree (inner folder) currently has **no
  `.env.local`** — see "Backend/database access pattern" below before trying to run this
  locally

## 5. Data/schema snapshot

**`schema.sql` in the repo root is out of date — confirmed this session (2026-08-22).**
Treat it as a partial history of migrations, not the live schema. Always verify table
structure against the live Supabase project (`list_tables` / `execute_sql` against
`information_schema`) before assuming `schema.sql` is complete, especially before writing
any migration.

Tables defined in `schema.sql` as of this writing:
`profiles`, `health_records`, `health_appointments`, `health_log_notes`,
`health_body_metrics`, `health_cycle_logs`, `finance_accounts`, `finance_transactions`,
`finance_loans`, `finance_subscriptions`, `finance_income`, `finance_debts`, `fx_rates`,
`business_projects`, `business_accounts`, `business_ideas`, `board_items`, `audit_log`,
`login_attempts`, `household_invites`.

**Confirmed live/in-use but missing from `schema.sql` entirely** (found by grepping the
file for tables the app code clearly depends on): `households` (the base household table
itself — `schema.sql` only has an `alter table households ...` line, never a `create
table`), `calendar_events`, `finance_expenses`, `finance_payment_schemes`, and whatever
backs the Memberships page. `finance_cards` is referenced in `BACKLOG.md` as a planned
table — check whether it exists live before assuming it doesn't.

Every table uses `owner_id` + a `visibility` enum (`private` / `shared_view` /
`mirrored_edit`) enforced via RLS through the shared `install_household_rls()` procedure —
this is the one schema convention that has held consistently, safe to assume it continues
for any new table.

## 6. Operating rules (from `CLAUDE.md` — restated here so Antigravity doesn't need to parse Claude-specific tooling config)

- **Explain why before how.** Before proposing code, architecture changes, new libraries, or
  refactors: state the problem, why this solution, alternatives considered, tradeoffs. Don't
  jump straight to code.
- **Simplest working solution.** Fewer dependencies, fewer moving parts, lower maintenance
  burden. If a feature can be 50 lines instead of 500, do 50. Avoid premature optimization,
  enterprise patterns, unnecessary abstractions.
- **Revenue before infrastructure.** For personal-use features this mostly means: is this
  worth the maintenance cost, is the UI attractive-but-simple, is operational cost low.
- **Monolith-first.** No microservices/queues/caching layers/worker infra without explaining
  why the simpler alternative is insufficient first.
- **Coding standards:** clean, readable, explicit naming, small functions, strong typing. No
  dead code, no unused dependencies, no excessive comments.
- **Verification standard before calling anything done:**
  1. Grep for every other usage of the changed field/component/pattern — assume a second
     call site exists until proven otherwise.
  2. Run a real build (`npm run build` / `tsc --noEmit`), not just a dev-server glance.
  3. Spot-check the live output (fetch/screenshot), not just the diff.
  4. Only then report done. If time is short, say what was and wasn't checked — don't imply
     full coverage you didn't do.
- **Communication:** direct, professional, no emojis, no hype, don't blindly agree — push
  back on weak ideas with a constructive alternative.

Full detail, the SEO/Content Playbook, and the underlying "Multi-AI Memory & Handoff Habits"
convention this file is built on all live in `CLAUDE.md` — read it if any of the above is
ambiguous.

## 7. Git & commit discipline

- **Small increments.** One logical change per commit where practical — this repo's history
  is genuinely used as a changelog (see commit messages like `Finance: Spending Plan, unified
  expense entry...`), keep that pattern up.
- **Always `git status` before any destructive command** (`checkout`, `restore`, `reset`,
  `clean`) — never assume the working tree is clean.
- **The pathspec gotcha:** a scoped `git add -A <path>` only stages changes *within* that
  path — it silently does **not** stage deletions of files outside it. If a change involved
  removing or renaming files elsewhere in the tree, a scoped `-A` will miss them and the
  commit will look incomplete without erroring. Use plain `git add -A` (repo-wide) unless
  there's a specific reason to scope it, and check `git status` after staging either way.
- **Do not blind-stage everything.** As of 2026-08-22, `git status` in the real working tree
  shows **~56 files as "modified"** that were never intentionally touched — confirmed
  harmless CRLF/LF line-ending noise (`core.autocrlf`/`core.eol` are unset in this repo, so
  Windows checkouts flip every line ending back and forth). Verified via `git diff`: every
  changed file shows identical line counts removed and re-added. **Only stage the specific
  files actually changed this session** — in GitHub Desktop, use the per-file checkboxes, not
  "select all"; from a CLI, `git add <specific files>`, never a blind `git add -A` on top of
  this noise without checking `git diff --stat` first. If this becomes annoying, the real fix
  is a `.gitattributes` normalizing line endings — not done yet, flagged in `MAINTENANCE.md`.
- **Credential asymmetry:** Claude Cowork gets a fresh GitHub PAT pasted into chat when
  needed and never persists it past that session (see Credential policy below); Antigravity
  should use its own persistent local git auth (already-configured GitHub Desktop /
  credential manager) and never ask Coco to paste a PAT it can already use directly.

## 8. Backend/database access pattern

- **Claude Cowork → Supabase:** via the Supabase MCP connector's `apply_migration` (DDL) and
  `execute_sql` (DML/queries) tools against project `pfchzkcteymiigsdokeo`. `apply_migration`
  has occasionally been blocked by a safety classifier in the past (root-caused once to the
  Supabase project still being internally named after a prior project) — if it recurs, the
  Supabase dashboard's own SQL Editor is the fallback, since it isn't subject to the same
  classifier.
- **Claude Cowork → GitHub:** **push is currently blocked outright** by this sandbox's git
  proxy for this repo (confirmed across multiple sessions, a fresh PAT does not fix it — the
  proxy authorizes repos at the session level, not per-credential). Workaround: Claude Cowork
  writes finished files to Coco's machine directly via `SendUserFile` +
  `device_commit_files` into the **inner** repo folder (see §3), and **Coco commits and
  pushes them himself via GitHub Desktop.** As of 2026-08-20 (commit `75656e4`) this
  workaround is confirmed working end-to-end — the repo is up to date with `origin/main`.
- **Antigravity → GitHub/Supabase:** uses its own local, persistent credentials on Coco's
  machine — no proxy restriction, should be able to commit/push directly and call Supabase
  via its own configured connection or the Supabase CLI. Confirm which before first use.
- **App runtime → Supabase:** standard `@supabase/ssr` client/server helpers in
  `lib/supabase/`, using `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY`. In production these are set as Render environment variables.
  **Locally, the real working tree has no `.env.local`** (only a `.env.example` template) —
  anyone running this app locally needs to create one from the template and fill in real
  values pulled from the Render dashboard's env vars (the authoritative current source) or
  Supabase's own project settings. Do not assume the stale outer folder's `.env.local` (if
  present) is current without checking it against Render first.

## 9. Known operational gotchas

- **The CRLF noise** described in §7 — don't mistake it for real drift, but don't ignore it
  either when staging.
- **Render service runtime/plan is locked at creation** — an existing service's runtime
  cannot be changed via dashboard or API; a wrong choice means creating a new service, not
  editing the old one. Also verify the actual plan after creating a service — it has
  defaulted to a paid plan despite a free-plan form selection before.
- **`apply_migration` can get blocked by a safety classifier** if the Supabase project's
  display name looks like it belongs to a different/sensitive project — rename the project
  in the Supabase dashboard if this happens, or use the SQL Editor directly.
- **A shared fix applied in isolation has broken a sibling call site before** (same DB field
  rendered through two different components) — this is why the Verification Standard in §6
  requires grepping for every usage, not just checking the file that was edited.
- **`households.owner_id`, `alerts_email_enabled`, and other `alter table` migrations exist
  as loose statements at the bottom of `schema.sql`, not as part of the original table
  definitions** — when reading the schema, check the whole file for later `alter table`
  statements against a table before assuming its `create table` block is complete.
- **Legal pages (`app/legal/*`) must never re-add a public description of the admin's
  household-overview/backup-export capability** — that capability is real and shipped, but
  Coco explicitly asked for it to not be publicly disclosed on the legal pages, "in any
  manner of speaking." If asked to touch `app/legal/privacy` or `app/legal/instructions`
  again, do not reintroduce this, in any phrasing.
- **Resend email alerts are code-complete but non-functional** until Coco buys and verifies
  a domain, sets 3 Render env vars, and wires an external cron — see `BACKLOG.md` and
  `MAINTENANCE.md`. Don't report this feature as "done," only as "built, pending external
  setup."

## 10. Handoff protocol

Two documents, two different purposes — don't confuse them:

- **`HANDOFF.md`** (repo root) is the **baton**. It gets **overwritten** each session/handoff
  — it always reflects only the current moment: what was just shipped (with verification
  status), what's queued next with enough context to act on without re-deriving intent from a
  diff, and any standing notes. It also carries the ready-to-paste Antigravity intro prompt at
  its top.
- **`PROJECT-STATUS.md`** (repo root) is the **log**. It is **append-only** — new sessions add
  a new dated section at the bottom, nothing is ever overwritten or deleted. This is the
  full reasoning trail across the project's life.
- **`BACKLOG.md`** (repo root) is the standing roadmap queue, checked off as items ship —
  read it every session, it's the single source of truth for what's next, not just this file
  or memory.

**Whichever agent finishes a session must update `HANDOFF.md` (overwrite) before stopping,**
and add a dated entry to `PROJECT-STATUS.md` (append) if anything meaningful shipped.

## 11. Active tasks snapshot

Pointer only — full detail lives in `HANDOFF.md` (what's immediately queued) and
`BACKLOG.md` (the full phased roadmap). As of 2026-08-22: Phase 1 (RLS penetration audit)
and most of Phase 2 (wearable sync, configurable dashboard widgets, calendar recurring-bill
projection, document vault) are the open frontier — see `BACKLOG.md` for the exact checklist.

## 12. Credential & secrets policy

- **Never commit secrets** — real values live in Render's environment variables (production)
  and in a local `.env.local` (gitignored, currently absent from the real working tree — see
  §8) for local dev. `.env.example` in the repo is a template only, no real values.
- **A GitHub PAT pasted into a Claude Cowork chat is single-use for that session only** — it
  is never written to a file, never committed, and should be treated as expired the moment
  the session ends. Don't reuse one across sessions; ask for a fresh one if push access is
  needed again (though push is currently proxy-blocked regardless — see §8).
- **Antigravity's local git/Supabase credentials are persistent by design** (that's the point
  of running locally) — no special handling needed beyond normal local-secret hygiene
  (don't print them into chat, don't commit `.env.local`).
- If either agent is ever unsure whether something is a secret, treat it as one.
