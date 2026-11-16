import type { Config } from "tailwindcss";

// Theme-aware colours. Every neutral the app uses (white, black, gray-*,
// base-*) resolves to a CSS variable defined in app/globals.css, so the
// SAME class (`text-white`, `bg-white/5`, `border-white/10`…) is correct in
// dark and light without per-class overrides. "white" therefore means
// "the foreground ink for this theme", not literal #fff — use the
// `keep-white` helper class (globals.css) where literal white is required.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("c-white"),
        black: v("c-black"),
        gray: {
          100: v("c-gray-100"),
          200: v("c-gray-200"),
          300: v("c-gray-300"),
          400: v("c-gray-400"),
          500: v("c-gray-500"),
          600: v("c-gray-600"),
        },
        base: {
          bg: v("c-bg"),
          panel: v("c-panel"),
          card: v("c-card"),
          border: v("c-border"),
        },
        accent: {
          purple: "#8b7cf9",
          pink: "#fb7fc4",
          blue: "#4fc3f7",
          orange: "#ffa552",
          green: "#3ddc97",
        },
      },
      borderColor: {
        DEFAULT: "rgb(var(--c-border-default))",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        "glow-purple": "0 10px 30px -8px rgba(139,124,249,0.5)",
        "glow-pink": "0 10px 30px -8px rgba(251,127,196,0.5)",
        "glow-blue": "0 10px 30px -8px rgba(79,195,247,0.5)",
      },
    },
  },
  plugins: [],
};
export default config;
