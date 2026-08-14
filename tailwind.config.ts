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
          purple: "#8b7cf9",
          pink: "#fb7fc4",
          blue: "#4fc3f7",
          orange: "#ffa552",
          green: "#3ddc97",
        },
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
