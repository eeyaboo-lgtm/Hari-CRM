# SECURITY.md — Hari-CRM Life Dashboard

Last updated: 2026-08-14.

This is a two-person household app holding real medical records, insurance details,
financial data, and account credentials metadata for Shenaal and Shalini. Treat it as
sensitive-data-grade, not toy-project-grade, while spending nothing.

Every control below runs on free tiers of tools already in use (Supabase, Next.js,
Render/Vercel). No paid security vendor is required at this scale.

## 1. Authentication

- **Provider:** Supabase Auth (GoTrue). Passwords hashed with bcrypt server-side —
  never handled or stored by app code.
- **MFA:** TOTP (authenticator app) enabled as an opt-in for both accounts. Free,
  built into Supabase Auth. Turn it on for both Shenaal and Shalini at setup time,
  not as an afterthought.
- **Session cookies:** httpOnly, Secure, SameSite=Lax, set via `@supabase/ssr`.
  JavaScript never touches the access/refresh token directly — removes the most
  common XSS-to-session-theft path.
- **Token lifetime:** short-lived access token (1 hour default), refresh token
  rotation on use. A stolen access token expires fast; a stolen refresh token is
  invalidated the moment it's used once (rotation detects reuse).

## 2. Brute-force / rate limiting

Two layers, both free:

1. **Supabase Auth's built-in rate limits** on sign-in/sign-up endpoints (on by
   default — verify it's not disabled in Auth settings).
2. **App-level lockout** (`login_attempts` table + `check_login_allowed()` function
   in `schema.sql`): 5 failed attempts in 15 minutes locks that email out of new
   attempts until the window rolls forward. Server calls `check_login_allowed()`
   *before* forwarding credentials to Supabase Auth, and logs every attempt
   (success or fail) to `login_attempts` regardless of outcome.
3. **hCaptcha (free tier)** on the login form after the 3rd failed attempt in a
   session — cheap deterrent against scripted brute-forcing, no cost at this volume.

Never expose *why* a login failed beyond "invalid email or password" — don't leak
whether an email is registered.

## 3. Authorization (Row Level Security)

RLS is the real authorization boundary, not app code. Every table is `enable row
level security` with default-deny, and access is granted only through the four
policies installed by `install_household_rls()` in `schema.sql`:
`owner_id = auth.uid()` for private data, plus a `visibility` flag
(`shared_view` / `mirrored_edit`) for anything explicitly opened to the other
household member. This means even a bug in the Next.js app can't leak data across
users — a malformed query still gets filtered by Postgres itself.

**Never bypass RLS from client code.** The `service_role` key (which bypasses RLS
entirely) must only ever be used in trusted server contexts — API routes / server
actions running on Render/Vercel — and must never ship in the client JS bundle.
Only the `anon`/publishable key goes to the browser.

## 4. File storage (medical documents, insurance PDFs, board images)

- Buckets are **private**, never public.
- Access only through short-lived **signed URLs** (5–15 min expiry), generated
  server-side after an RLS-backed ownership check — never a permanent public link.
- Validate file type and size **server-side**, not just in the upload widget
  (client-side checks are advisory only, trivially bypassed).
- No third-party virus scanning at this budget — mitigate by only ever accepting
  files the household members themselves upload (not public-facing intake), which
  removes the realistic attack surface for malicious uploads.

## 5. Transport & headers

- HTTPS enforced everywhere (Vercel/Render provide this by default — verify no
  plain-HTTP fallback exists).
- Security headers set in `next.config.js` / middleware:
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` scoped to Supabase's domain + self, no wildcard `*`.

## 6. Secrets handling

- All keys/tokens live in Render/Vercel environment variables, never in committed
  files. `.env*` stays in `.gitignore`.
- **Incident record (keep entries like this going forward — don't delete history):**
  - 2026-08-14: A GitHub PAT (`ghp_4dlS...`, labeled DHW) was pasted into chat
    across multiple Cowork sessions. User instructed to revoke at
    github.com/settings/tokens. **Verify this was done before considering the
    incident closed.**
- Rule going forward: never paste a live secret into a chat session to "give
  access." Use env vars set directly on the hosting platform, or an authorized
  MCP connector, instead.

## 7. Dependency & code hygiene

- GitHub Dependabot alerts enabled on the repo (free).
- `npm audit` run before any dependency bump gets merged.
- Zod (or equivalent) validation on every form submission and API route input —
  never trust client-supplied data shape.
- Parameterized queries only — the Supabase client library does this by default;
  never hand-build SQL strings from user input outside the `install_household_rls`
  DDL helper (which only ever takes fixed, hardcoded table names, never user input).

## 8. Audit trail

`audit_log` table records login success/failure and sensitive record events
(created/viewed/exported). Both household members can read the full log — full
transparency between the two of you is a feature here, not a bug, since this is a
household app, not a multi-tenant product hiding users from each other.

## 9. Backups

Builds on the existing Hari-CRM `backup.py` convention:
- Supabase free tier retains automatic daily backups for ~7 days — know this limit,
  it is not a substitute for your own backups of anything irreplaceable.
- Extend the rotating-backup pattern already used for `app.py` (5 rotating copies)
  to periodic `pg_dump` exports of this project's database, stored encrypted,
  never committed to a public repo.

## 10. What this does *not* cover (be honest about the ceiling)

At zero budget there is no: penetration testing, SOC2-style compliance audit, WAF,
or dedicated security team. This is "well-configured indie-scale hardening," not an
enterprise security program. Revisit this file if the app ever handles data for
anyone outside the household, or if either of you starts using it from an
unmanaged/shared device.

---
*Update this file whenever a security-relevant decision is made — append, following
the same dated-append convention as `SEO-STRATEGY.md`. Don't silently edit past
entries away.*
