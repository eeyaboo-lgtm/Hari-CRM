# Google Sign-In Setup (one-time, ~5 min)

App code is already done and deployed — the "Continue with Google" button on
`/login` and `/signup` will work the instant these two steps are done. No
further code changes needed either way.

## 1. Google Cloud Console — create OAuth credentials
1. Go to https://console.cloud.google.com/apis/credentials (create/select a project first if needed).
2. If prompted, configure the **OAuth consent screen** first: User type "External", app name "Hari-CRM", your email as support/developer contact. Publishing status can stay "Testing" for personal use (adds a warning screen but works fine) or "In production" if you want no warning.
3. Click **Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized redirect URIs** — add exactly this (get the exact URL by running `get_project_url` for project `pfchzkcteymiigsdokeo`, or check `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`):
   `https://pfchzkcteymiigsdokeo.supabase.co/auth/v1/callback`
6. Save. Copy the **Client ID** and **Client Secret** shown.

## 2. Supabase Dashboard — enable the provider
1. Go to https://supabase.com/dashboard/project/pfchzkcteymiigsdokeo/auth/providers
2. Find **Google**, toggle it on.
3. Paste the Client ID and Client Secret from step 1.
4. Save.

That's it — test at `/login`, click "Continue with Google". First-time
Google sign-ins auto-create a new household (named "`<your name>`'s
Household") via the same trigger real email signup uses — rename it later
if there's a Settings option, or ask Claude to add one.

## Also verify while you're in the Supabase dashboard
Authentication → Providers → Email → **"Confirm email"** should be switched
ON so new signups must click the emailed link before their household is
usable — this can't be checked or set via any available MCP tool, only the
dashboard toggle.
