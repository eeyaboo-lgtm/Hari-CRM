import Link from "next/link";
import { login } from "./actions";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Enter a valid email and password.",
  locked: "Too many failed attempts. Try again in a few minutes.",
  invalid_credentials: "Invalid email or password.",
  oauth_failed: "Google sign-in failed. Try again.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-bg px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-base-panel p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-accent-blue" />
          <div className="h-3 w-3 rounded-full bg-accent-pink" />
        </div>
        <h1 className="text-xl font-semibold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-400">Sign in to the household dashboard.</p>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mt-6">
          <GoogleSignInButton next="/dashboard" />
        </div>
        <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
          <div className="h-px flex-1 bg-base-border" />
          or
          <div className="h-px flex-1 bg-base-border" />
        </div>

        <form action={login} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs text-gray-400" htmlFor="password">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-accent-purple">
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-accent-purple to-accent-blue py-2.5 text-sm font-medium text-white"
          >
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          New household?{" "}
          <Link href="/signup" className="text-accent-purple">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
