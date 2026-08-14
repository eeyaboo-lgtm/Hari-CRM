"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

// Household passcode is intentionally short (6-digit shared code, not a
// per-site password) — private 2-person app, already gated behind
// check_login_allowed()'s 5-attempts/15-min lockout below.
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_input");
  }

  const { email, password } = parsed.data;
  const ip = headers().get("x-forwarded-for") ?? "unknown";
  const admin = createAdminClient();

  // Lockout check — see check_login_allowed() and login_attempts in schema.sql.
  // Runs before Supabase Auth even sees the request, using the service_role
  // client since login_attempts has no client-facing RLS policy at all.
  const { data: allowed } = await admin.rpc("check_login_allowed", {
    p_email: email,
  });

  if (allowed === false) {
    redirect("/login?error=locked");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Log every attempt, success or fail, regardless of outcome — this table
  // has no client RLS access, so it can only be written from here.
  await admin.from("login_attempts").insert({
    email,
    succeeded: !error,
    ip_address: ip === "unknown" ? null : ip,
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
