"use client";

// Dashboard's "Quick add" button used to do nothing (no onClick at all).
// This is a lightweight launcher, not a new add-form system — each link
// takes you straight to the module whose own add form is already visible
// near the top of that page (Finance/Health/Calendar/etc. all already show
// their add form inline, not behind an extra click), so this is a genuine
// shortcut, not a fake one.

import Link from "next/link";
import { X, Wallet, HeartPulse, Activity, CalendarDays, Sparkles, Award, Briefcase } from "lucide-react";

const QUICK_ADD_TARGETS = [
  { label: "Add an expense or bill", href: "/finance", icon: Wallet, color: "text-accent-blue" },
  { label: "Log a health entry", href: "/health", icon: HeartPulse, color: "text-accent-pink" },
  { label: "Log a fitness entry", href: "/fitness", icon: Activity, color: "text-accent-blue" },
  { label: "Add a calendar event", href: "/calendar", icon: CalendarDays, color: "text-accent-orange" },
  { label: "Add a vision goal or trip", href: "/vision", icon: Sparkles, color: "text-accent-green" },
  { label: "Add a membership", href: "/memberships", icon: Award, color: "text-accent-purple" },
  { label: "Add a business idea", href: "/business", icon: Briefcase, color: "text-accent-blue" },
];

export default function QuickAddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm rounded-xl2 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="relative z-10 mb-3 flex items-center justify-between">
          <h4 className="font-medium text-white">Quick add</h4>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="relative z-10 space-y-1.5">
          {QUICK_ADD_TARGETS.map(({ label, href, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition-colors hover:bg-white/5"
            >
              <Icon size={16} className={color} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
