# AGENTS.md

Entry point for any AI tool working on this project — Claude Cowork, Claude Code/Antigravity,
OpenAI Codex, or anything else. **Read this file first, before touching code or content.**

## What this project is

[One or two sentences — project name, niche, what it does. Copy from CLAUDE.md's Purpose
section so this stays in sync, or just link to it: see `CLAUDE.md`.]

## Stack

[List the real stack in use — framework, database, hosting, key third-party services. Keep
this accurate; it's the first thing a new tool/session needs to not guess wrong.]

## What this project is (filled in 2026-08-14)

A household life dashboard for Shenaal (husband) and Shalini (wife): health &
insurance records, multi-currency finance (LKR/AED/USD), business project
tracking (ShelfPulse/RetailSuite/Dino History World quick-launch + health checks),
and a shared vision/mood board. Every piece of data is owner-scoped with a
private/shared/mirrored visibility flag. Not for sale — personal infrastructure.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth +
Storage) on the repurposed project `pfchzkcteymiigsdokeo`, deployed on Render.
Old Flask/Python version archived at `legacy-flask/`, not in active use.

## Where the other docs live (read in this order after this file)

1. `CLAUDE.md` — standing rules, coding/architecture/communication standards, the SEO &
   Content Playbook, and the Multi-AI Memory & Handoff Habits convention this file follows.
2. **`PROJECT-STATUS.md`** — current state, what's shipped, what's next, exact blockers.
   **Read this before doing anything** — has a `Last updated:` line, check it's recent.
3. `SECURITY.md` — the security baseline this app is built to. Binding for any auth,
   RLS, storage, or secrets-handling work.
4. `schema.sql` — the full database design. Apply via Supabase `apply_migration`, not
   raw `execute_sql` (it's DDL).
5. `SEO-STRATEGY.md` — not applicable to this project (no public-facing content).
6. `CONTENT-STYLE.md` — not applicable to this project (no published content).

## Environment / credential gotchas

[This is the section that saves the most time. Fill in anything a fresh session/tool will hit
blind otherwise — examples from a prior project, replace with this project's real ones:
- "Fresh sandboxes start with zero git auth — check early, prefer the platform's own
  connector over a re-pasted personal access token."
- "Tool X tends to forget to push after committing — verify the remote actually has the
  latest commit before assuming a deploy will pick it up."
- "Writes through connector Y get blocked by a safety classifier even though reads work —
  fallback is pasting the SQL/command directly into the platform's own console."]

## Handoff convention

New information gets **appended as a dated section** to the relevant doc (`ROADMAP.md`,
`SEO-STRATEGY.md`, etc.), never silently overwritten — the reasoning trail matters as much as
the current state to a tool picking this up cold. See "Multi-AI Memory & Handoff Habits" in
`CLAUDE.md` for the full convention.

Before ending a work session, leave an explicit note in the relevant doc: what's done, what's
unresolved, what the next concrete action is.

---
*Template — fill in every bracketed section for the real project, then delete this line.*
