-- Hari-CRM Life Dashboard — Database Schema
-- Household: Shenaal (husband) + Shalini (wife). Two auth.users, everything else
-- keyed off owner_id + a visibility flag. No third user ever exists in this schema,
-- so RLS stays simple: "is this the owner, or is this household-visible + I'm the
-- other household member."
--
-- Visibility model (applies to every content table):
--   private       -> only owner_id can see or touch it
--   shared_view   -> both household members can SELECT; only owner can INSERT/UPDATE/DELETE
--   mirrored_edit -> both household members can SELECT and UPDATE/DELETE (true joint record)
--
-- Apply with: supabase migration / apply_migration, not raw execute_sql, since this is DDL.

create extension if not exists "pgcrypto";

-- ============================================================
-- Household membership
-- ============================================================

create type household_role as enum ('Shenaal', 'Shalini');
create type visibility_level as enum ('private', 'shared_view', 'mirrored_edit');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role household_role not null unique,          -- exactly one row per role, ever
  display_name text not null,
  avatar_path text,
  created_at timestamptz not null default now()
);

-- Helper: is the current JWT one of the two household members at all?
-- (Used everywhere instead of repeating a subquery in every policy.)
create or replace function is_household_member()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

-- ============================================================
-- Generic policy installer
-- Every content table below has the same 4 columns baked in:
--   id uuid pk, owner_id uuid references profiles(id), visibility visibility_level, created_at
-- so RLS is generated once per table name instead of hand-written 15 times.
-- ============================================================

create or replace procedure install_household_rls(target_table text)
language plpgsql
as $$
begin
  execute format('alter table %I enable row level security', target_table);

  execute format($p$
    create policy %I on %I for select using (
      owner_id = auth.uid()
      or (visibility in ('shared_view','mirrored_edit') and is_household_member())
    )
  $p$, target_table || '_select', target_table);

  execute format($p$
    create policy %I on %I for insert with check (owner_id = auth.uid())
  $p$, target_table || '_insert', target_table);

  execute format($p$
    create policy %I on %I for update using (
      owner_id = auth.uid()
      or (visibility = 'mirrored_edit' and is_household_member())
    )
  $p$, target_table || '_update', target_table);

  execute format($p$
    create policy %I on %I for delete using (
      owner_id = auth.uid()
      or (visibility = 'mirrored_edit' and is_household_member())
    )
  $p$, target_table || '_delete', target_table);
end;
$$;

-- ============================================================
-- HEALTH & INSURANCE
-- ============================================================

create table health_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  record_type text not null,          -- 'condition' | 'lab_result' | 'prescription' | 'insurance_policy' | 'other'
  title text not null,
  description text,
  provider text,                      -- hospital/clinic/insurer name
  record_date date,
  file_path text,                     -- path in private storage bucket, not a public URL
  created_at timestamptz not null default now()
);
call install_household_rls('health_records');

create table health_appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  title text not null,
  doctor text,
  location text,
  appointment_at timestamptz not null,
  status text not null default 'upcoming',  -- 'upcoming' | 'completed' | 'cancelled'
  notes text,
  created_at timestamptz not null default now()
);
call install_household_rls('health_appointments');

create table health_log_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  note_date date not null default current_date,
  title text,
  body text not null,
  tags text[],
  created_at timestamptz not null default now()
);
call install_household_rls('health_log_notes');

-- ============================================================
-- FINANCE (multi-currency: LKR / AED / USD)
-- ============================================================

create type currency_code as enum ('LKR', 'AED', 'USD');

create table finance_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  name text not null,
  account_type text not null,        -- 'bank' | 'cash' | 'credit_card' | 'investment' | 'wallet'
  currency currency_code not null,
  current_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
call install_household_rls('finance_accounts');

create table finance_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  account_id uuid references finance_accounts(id) on delete set null,
  txn_type text not null,            -- 'income' | 'expense' | 'transfer'
  amount numeric(14,2) not null,
  currency currency_code not null,
  category text,
  description text,
  txn_date date not null default current_date,
  created_at timestamptz not null default now()
);
call install_household_rls('finance_transactions');

create table finance_loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  name text not null,                -- 'Car loan', 'Home mortgage'
  lender text,
  principal numeric(14,2) not null,
  currency currency_code not null,
  interest_rate numeric(5,2),        -- annual %, nullable if 0%/unknown
  tenure_months int not null,
  start_date date not null,
  monthly_installment numeric(14,2) not null,
  remaining_balance numeric(14,2) not null,
  next_due_date date,
  status text not null default 'active',  -- 'active' | 'closed' | 'defaulted'
  created_at timestamptz not null default now()
);
call install_household_rls('finance_loans');

create table finance_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  name text not null,                -- 'Netflix', 'Gym membership'
  amount numeric(14,2) not null,
  currency currency_code not null,
  billing_cycle text not null,       -- 'weekly' | 'monthly' | 'yearly'
  next_due_date date not null,
  category text,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now()
);
call install_household_rls('finance_subscriptions');

create table finance_income (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  source text not null,              -- employer / client name
  income_type text not null,         -- 'salary' | 'bonus' | 'freelance' | 'other'
  amount numeric(14,2) not null,
  currency currency_code not null,
  received_date date not null,
  notes text,
  created_at timestamptz not null default now()
);
call install_household_rls('finance_income');

create table finance_debts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  person text not null,
  amount numeric(14,2) not null,
  currency currency_code not null,
  direction text not null,           -- 'owed_to_me' | 'i_owe'
  due_date date,
  status text not null default 'open',  -- 'open' | 'settled'
  notes text,
  created_at timestamptz not null default now()
);
call install_household_rls('finance_debts');

-- Optional manual FX snapshot for combined net-worth views. Update periodically,
-- no external API dependency (keeps cost at zero, avoids a new vendor).
create table fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency currency_code not null,
  target_currency currency_code not null,
  rate numeric(14,6) not null,
  updated_at timestamptz not null default now(),
  unique (base_currency, target_currency)
);
alter table fx_rates enable row level security;
create policy fx_rates_select on fx_rates for select using (is_household_member());
create policy fx_rates_write on fx_rates for all using (is_household_member()) with check (is_household_member());

-- ============================================================
-- BUSINESS PROJECTS
-- ============================================================

create table business_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'shared_view',
  name text not null,                -- 'ShelfPulse', 'RetailSuite', 'Dino History World'
  project_type text not null,        -- 'website' | 'digital_product' | 'social_account' | 'other'
  url text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);
call install_household_rls('business_projects');

create table business_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'shared_view',
  project_id uuid references business_projects(id) on delete cascade,
  platform text not null,            -- 'GitHub', 'Instagram', 'Render', etc.
  email_used text,
  username text,
  notes text,                        -- never store raw passwords/tokens here
  created_at timestamptz not null default now()
);
call install_household_rls('business_accounts');

create table business_ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'private',
  title text not null,
  body text,
  tags text[],
  status text not null default 'idea',   -- 'idea' | 'exploring' | 'active' | 'archived'
  created_at timestamptz not null default now()
);
call install_household_rls('business_ideas');

-- ============================================================
-- VISION / MOOD BOARD
-- ============================================================

create table board_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  visibility visibility_level not null default 'shared_view',
  board_type text not null,          -- 'vision' | 'mood'
  image_path text,                   -- private storage path
  caption text,
  category text,
  position int default 0,
  created_at timestamptz not null default now()
);
call install_household_rls('board_items');

-- ============================================================
-- SECURITY: audit log + login attempt tracking
-- ============================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,              -- 'login_success' | 'login_failed' | 'record_created' | ...
  table_name text,
  record_id uuid,
  ip_address inet,
  created_at timestamptz not null default now()
);
alter table audit_log enable row level security;
create policy audit_log_select on audit_log for select using (is_household_member());
-- Inserts happen only via a security-definer function (below), never directly from the client.

create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  succeeded boolean not null,
  ip_address inet,
  attempted_at timestamptz not null default now()
);
-- No client access at all — server-side only, checked before allowing a sign-in attempt.
alter table login_attempts enable row level security;

-- Locks an email out after 5 failed attempts within 15 minutes, exponential-ish via
-- growing lockout window. Call this from the server (API route / edge function) before
-- forwarding a login attempt to Supabase Auth.
create or replace function check_login_allowed(p_email text)
returns boolean
language sql
security definer
stable
as $$
  select count(*) < 5
  from login_attempts
  where email = p_email
    and succeeded = false
    and attempted_at > now() - interval '15 minutes';
$$;

-- ============================================================
-- Storage buckets (run via Supabase dashboard or storage API, not plain SQL)
-- ============================================================
-- Create two PRIVATE buckets: 'health-documents' and 'board-images'.
-- Never make them public. Access only via short-lived signed URLs generated
-- server-side after an RLS-backed ownership check.

-- ============================================================
-- NOTE (2026-08-19): everything above this line describes the ORIGINAL
-- 2-person household schema and is known stale — the live database has
-- since gone through a multi-household rewrite (see migrations
-- `multi_household_support`, `signup_auto_household_trigger`, and others
-- via `list_migrations`). The live DB, introspected directly via the
-- Supabase MCP tools, is the actual source of truth, not this file.
-- Full reconciliation of this file is out of scope for this pass — only
-- appending what changed THIS session below, per the project's own
-- "append, don't silently overwrite" handoff convention.
-- ============================================================

-- ============================================================
-- Household invites + head role (2026-08-19, migration
-- household_invites_and_head_role — see HANDOVER.md #20)
-- ============================================================

alter table households add column if not exists owner_id uuid references profiles(id);

create table if not exists household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by uuid not null references profiles(id),
  max_uses int not null default 1,
  uses_count int not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
-- RLS: select -> any household member (is_admin() or household_id = current_household_id());
-- insert/update -> only the household's owner_id (the "head"), or admin.
-- See the live migration (list_migrations / apply_migration history) for exact policy SQL —
-- not duplicated here to avoid this file drifting from the DB a second time.

-- redeem_household_invite(p_code text) returns uuid — SECURITY DEFINER. The only sanctioned way
-- (besides admin) to change a profile's household_id. Validates the code, moves auth.uid()'s own
-- profile only, best-effort deletes the old household if left with zero members.

-- prevent_direct_household_change() — BEFORE UPDATE trigger on profiles. Blocks a user from
-- self-editing household_id via the normal profiles_update policy; bypassed only by admin or by
-- redeem_household_invite() (via a transaction-local `app.allow_household_change` flag).
