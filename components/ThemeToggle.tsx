"use client";

// Appearance controls: Theme (dark/light) and Style (glass/clean). Both are
// saved per device in localStorage and applied as attributes on <html>;
// app/layout.tsx applies them before first paint so there is no flash.
import { Moon, Sun, Sparkles, Square, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import InfoTip from "@/components/InfoTip";

type Theme = "dark" | "light";
type UiStyle = "glass" | "clean";

const ACTIVE = "bg-accent-purple text-black";
const IDLE = "text-gray-300 hover:bg-white/5";

function Segment<T extends string>({
  label,
  tip,
  value,
  options,
  onChange,
}: {
  label: string;
  tip: string;
  value: T;
  options: { value: T; label: string; icon: LucideIcon }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <span className="text-sm font-medium text-gray-100">{label}</span>
        <InfoTip text={tip} label={`What does ${label} do?`} />
      </div>
      <div role="group" aria-label={label} className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
        {options.map((o) => {
          const Icon = o.icon;
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${active ? ACTIVE : IDLE}`}
            >
              <Icon size={16} aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [uiStyle, setUiStyle] = useState<UiStyle>("glass");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("theme") === "light") setTheme("light");
      if (window.localStorage.getItem("uiStyle") === "clean") setUiStyle("clean");
    } catch {
      // storage unavailable — defaults stand
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (uiStyle === "clean") root.setAttribute("data-style", "clean");
    else root.removeAttribute("data-style");
    try {
      window.localStorage.setItem("theme", theme);
      window.localStorage.setItem("uiStyle", uiStyle);
    } catch {
      // storage unavailable — applies for this visit only
    }
  }, [theme, uiStyle, loaded]);

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-5">
      <Segment<Theme>
        label="Theme"
        tip="Dark is easier on the eyes at night. Light is easier to read in bright rooms. Saved on this device."
        value={theme}
        onChange={setTheme}
        options={[
          { value: "dark", label: "Dark", icon: Moon },
          { value: "light", label: "Light", icon: Sun },
        ]}
      />
      <Segment<UiStyle>
        label="Style"
        tip="Glass adds frosted cards, glows and shine. Clean is flat and sharper, and runs smoother on older phones."
        value={uiStyle}
        onChange={setUiStyle}
        options={[
          { value: "glass", label: "Glass", icon: Sparkles },
          { value: "clean", label: "Clean", icon: Square },
        ]}
      />
    </div>
  );
}
