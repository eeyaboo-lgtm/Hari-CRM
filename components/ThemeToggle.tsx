"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className="glass-card flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-gray-200 transition-colors hover:bg-white/[0.06]"
    >
      <span className="relative z-10 flex items-center gap-2">
        {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        {theme === "dark" ? "Dark mode" : "Light mode"}
      </span>
    </button>
  );
}
