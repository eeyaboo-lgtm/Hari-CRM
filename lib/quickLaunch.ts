// Shared type/storage-key/color-lookup for the Dashboard's customizable
// Quick Launch shortcuts (Phase 0 backlog — previously hardcoded to
// ShelfPulse/RetailSuite only). Editable in Settings, rendered on the
// Dashboard — both import from here so they can never drift apart.
//
// Per-device preference (localStorage), same convention as Finance's
// budget/hideBalances — these are UI shortcuts, not shared household data.
//
// Colors are a fixed lookup of full literal Tailwind class strings, not
// built via template-literal interpolation — see feedback_tailwind_dynamic_classes
// in memory for why that matters (the static scanner drops interpolated
// class names in both dev and prod).

export type QuickLaunchColor = "pink" | "blue" | "purple" | "green" | "orange";

export type QuickLaunchItem = {
  id: string;
  label: string;
  url: string;
  color: QuickLaunchColor;
};

export const QUICK_LAUNCH_STORAGE_KEY = "dashboard.quickLaunch.v1";

export const DEFAULT_QUICK_LAUNCH: QuickLaunchItem[] = [
  { id: "ql1", label: "ShelfPulse", url: "https://shelfpulse-j820.onrender.com/", color: "pink" },
  { id: "ql2", label: "RetailSuite", url: "https://retailsuite.onrender.com/", color: "blue" },
];

export const QUICK_LAUNCH_GRADIENT: Record<QuickLaunchColor, string> = {
  pink: "from-pink-500 to-rose-400 shadow-glow-pink",
  blue: "from-sky-500 to-blue-500 shadow-glow-blue",
  purple: "from-accent-purple to-violet-500 shadow-glow-purple",
  green: "from-emerald-500 to-accent-green shadow-glow-blue",
  orange: "from-accent-orange to-amber-500 shadow-glow-pink",
};

/** Small swatch classes for the color picker in Settings — same literal-string convention. */
export const QUICK_LAUNCH_SWATCH: Record<QuickLaunchColor, string> = {
  pink: "bg-pink-500",
  blue: "bg-sky-500",
  purple: "bg-accent-purple",
  green: "bg-accent-green",
  orange: "bg-accent-orange",
};
