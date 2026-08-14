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
    <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-base-border bg-base-panel p-5">
      <div>
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="h-3 w-3 rounded-sm bg-accent-blue" />
          <div className="h-3 w-3 rounded-full bg-accent-pink" />
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
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-lg shadow-accent-purple/20"
                    : "text-gray-400 hover:bg-base-card hover:text-gray-200"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="rounded-xl2 bg-base-card p-4">
        <p className="text-sm font-medium text-gray-100">Status check</p>
        <p className="mt-1 text-xs text-gray-400">
          ShelfPulse & RetailSuite health is one card away — see Business Projects.
        </p>
      </div>
    </aside>
  );
}
