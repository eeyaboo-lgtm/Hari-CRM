# PROJECT-STATUS.md — Hari-CRM

Last updated: 2026-08-14. Follows the dated-append convention in CLAUDE.md —
new sessions add a new section below, never overwrite this one.

## 2026-08-14 — Pivot to life dashboard, rebuild started

**Decision:** Hari-CRM is being repurposed from a ShelfPulse/RetailSuite project
dashboard into a full household life dashboard for Shenaal (husband) and Shalini
(wife) — health/insurance, multi-currency finance (LKR/AED/USD), business
projects, vision/mood board. Old project-status feature becomes one small panel,
not the whole app. Rebuilt fresh in Next.js + Tailwind + Supabase (old default
stack per CLAUDE.md), replacing the Flask app — **old Flask app is archived, not
deleted, at `legacy-flask/`.**

### What's done
- `schema.sql` — full DB design (profiles, health, finance, business, vision/mood
  board), all tables owner_id + visibility (`private`/`shared_view`/`mirrored_edit`)
  enforced via RLS.
- `SECURITY.md` — zero-cost hardening baseline (MFA, brute-force lockout, RLS,
  private storage + signed URLs, security headers, secrets handling).
- Full Next.js app scaffolded: dashboard home (replicates a reference screenshot's
  dark glassmorphic layout, repurposed for life-dashboard content), login page
  with server-side lockout, and stub pages for Health/Finance/Business/Vision.
- **Build verified clean** — `npm run build` passes, all routes compile, types
  check. Verified in an isolated `/tmp` copy, not the synced workspace (avoids
  node_modules sync overhead in this folder).

### Supabase project
- Reused (not shared) the old **RetailSuite** Supabase project, ref
  `pfchzkcteymiigsdokeo`. Verified independently (not just trusting another
  session's self-report): RetailSuite's own code and Render env vars were
  confirmed decommissioned from Supabase before this was touched. Project
  restored from paused state successfully.
- **Blocker:** applying the schema migration is being denied by a safety
  classifier — almost certainly because the project is still literally named
  "RetailSuite Project" in the Supabase dashboard. **Action needed: rename it**
  (Supabase dashboard → this project → Settings → General → Project name — no
  MCP tool exists for this, dashboard-only, ~10 seconds). Once renamed, retry
  `apply_migration` with the full contents of `schema.sql`.
- Note: 3 leftover empty RetailSuite tables (`users`, `staff`, `rota`, 0 rows
  each) still exist in this project. Left alone (drop was also classifier-blocked)
  — harmless, don't conflict with the new schema's table names.
- Storage buckets (`health-documents`, `board-images`) not yet created — the
  `insert into storage.buckets` statement failed right after restore
  ("relation storage.buckets does not exist", likely the storage service still
  initializing). Retry after the schema migration succeeds.

### Deployment — not started
- The live Render URL (hari-rlxe.onrender.com) is still serving the **old Flask
  app** — nothing has been pushed to GitHub yet. Render's auto-deploy is already
  enabled (`autoDeploy: yes`, triggers on commit) — no change needed there,
  contrary to what it might look like from the "Not Found" page.
- **Blocker:** this workspace folder is not a git working copy (`git remote -v`
  fails — "not a git repository"). Pushing needs either (a) the Hari-CRM GitHub
  token so this folder can be `git init` + remote-added + pushed, or (b) the
  GitHub connector authorized via claude.ai connector settings so an MCP tool
  can commit directly. Have not received a working Hari-CRM token this session
  (only DHW's token was pasted, which is unrelated and should be revoked — see
  SECURITY.md incident log).
- **Blocker:** Render's service config (`srv-d7rkc3n7f7vs73d1u4u0`, name "Hari")
  still has Python build/start commands (`pip install -r requirements.txt` /
  `gunicorn dashboard.app:app`). No MCP tool found to update an existing
  service's build/start command — needs a manual dashboard edit (Render →
  Hari service → Settings → Build & Deploy) to Node: build
  `npm install && npm run build`, start `npm start`. Do this *before* or in the
  same push as the first Next.js commit, or the deploy will fail.
- `.env.example` lists the 3 env vars the Render service will need once the
  Supabase project is unblocked: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Next concrete actions (in order)
1. Rename the Supabase project away from "RetailSuite Project."
2. Re-run `apply_migration` with `schema.sql`'s full contents against
   `pfchzkcteymiigsdokeo`.
3. Create the 2 private storage buckets.
4. Get Hari-CRM GitHub push access sorted (token or connector auth).
5. Change Render's Hari service build/start commands to Node + set the 3 Supabase
   env vars.
6. Push the Next.js app — auto-deploy picks it up from there.
7. Sign up the two real accounts (Shenaal, Shalini) through the deployed app,
   then insert matching `profiles` rows with the right `role`.
8. Build out Health, Business, Vision modules to the same depth as Finance
   (currently the most complete non-dashboard module).

### Also flagged, not yet resolved
- A DHW GitHub token (`ghp_4dlS...`) was pasted into chat across sessions.
  User has decided not to revoke it (says it's only in use for a month on
  Claude) — noted, not re-raising per their instruction.
