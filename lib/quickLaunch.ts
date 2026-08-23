// Color palette for Dashboard shortcut tiles.
//
// 2026-08-23: the old standalone Quick Launch system (a hardcoded
// ShelfPulse/RetailSuite default shown to every signed-in account on every
// device, stored in per-device localStorage) is retired. It's what let a
// different household's fresh browser show Shenaal's proprietary business
// links by default — see AGENTS.md's gotchas / MAINTENANCE.md.
//
// Dashboard tiles are now just `business_projects` rows with
// `pinned_dashboard = true`, which is already correctly scoped per
// household via existing RLS (install_household_rls) — no separate
// visibility logic needed. This file now only holds the shared color
// lookup so pinned tiles still get their glossy gradient look, cycled by
// index (see app/dashboard/page.tsx).
//
// Colors are a fixed lookup of full literal Tailwind class strings, not
// built via template-literal interpolation — see feedback_tailwind_dynamic_classes
// in memory for why that matters (the static scanner drops interpolated
// class names in both dev and prod).

export type QuickLaunchColor = "pink" | "blue" | "purple" | "green" | "orange";

export const QUICK_LAUNCH_COLOR_ORDER: QuickLaunchColor[] = ["pink", "blue", "purple", "green", "orange"];

export const QUICK_LAUNCH_GRADIENT: Record<QuickLaunchColor, string> = {
  pink: "from-pink-500 to-rose-400 shadow-glow-pink",
  blue: "from-sky-500 to-blue-500 shadow-glow-blue",
  purple: "from-accent-purple to-violet-500 shadow-glow-purple",
  green: "from-emerald-500 to-accent-green shadow-glow-blue",
  orange: "from-accent-orange to-amber-500 shadow-glow-pink",
};

/** Deterministic color for a tile by its position in the pinned list — same tile always gets the same color across renders. */
export function quickLaunchColorFor(index: number): QuickLaunchColor {
  return QUICK_LAUNCH_COLOR_ORDER[index % QUICK_LAUNCH_COLOR_ORDER.length];
}
