"use client";

import {
  LayoutGrid,
  HeartPulse,
  Wallet,
  Briefcase,
  Sparkles,
  Settings,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "health", label: "Health & Insurance", icon: HeartPulse },
  { key: "finance", label: "Finance", icon: Wallet },
  { key: "business", label: "Business Projects", icon: Briefcase },
  { key: "vision", label: "Vision & Mood Board", icon: Sparkles },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [active, setActive] = useState("dashboard");

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-white/5 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div>
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="h-3 w-3 rounded-sm bg-accent-blue shadow-glow-blue" />
          <div className="h-3 w-3 rounded-full bg-accent-pink shadow-glow-pink" />
          <div
            className="h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-accent-orange"
            aria-hidden
          />
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const isActive = key === active;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "glossy-gradient bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-glow-purple"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span className="relative z-10 flex items-center gap-3">
                  <Icon size={18} />
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="glass-card rounded-xl2 p-4">
        <p className="relative z-10 text-sm font-medium text-gray-100">Status check</p>
        <p className="relative z-10 mt-1 text-xs text-gray-400">
          ShelfPulse & RetailSuite health is one card away — see Business Projects.
        </p>
      </div>
    </aside>
  );
}
