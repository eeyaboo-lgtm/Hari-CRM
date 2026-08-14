import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#15161c",
          panel: "#1b1d26",
          card: "#20222e",
          border: "#2a2d3a",
        },
        accent: {
          purple: "#7c6cf6",
          pink: "#f472b6",
          blue: "#38bdf8",
          orange: "#fb923c",
          green: "#34d399",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
