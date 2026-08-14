"use client";

import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Bell, ShieldCheck, Users } from "lucide-react";

const PEOPLE = [
  { key: "shenaal", label: "Shenaal" },
  { key: "shalini", label: "Shalini" },
];

type Notif = { emailReminders: boolean; browserAlerts: boolean; weeklyDigest: boolean };

const NOTIF_ROWS: [keyof Notif, string][] = [
  ["emailReminders", "Email reminders for bills & appointments"],
  ["browserAlerts", "Browser alerts for shared updates"],
  ["weeklyDigest", "Weekly summary digest"],
];

export default function SettingsPage() {
  const [names, setNames] = useLocalStorage<Record<string, string>>("profileNames", {
    shenaal: "Shenaal",
    shalini: "Shalini",
  });
  const [notif, setNotif] = useLocalStorage<Notif>("notificationPrefs", {
    emailReminders: true,
    browserAlerts: false,
    weeklyDigest: true,
  });

  const toggle = (key: keyof Notif) => setNotif((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 font-medium text-white">Appearance</h2>
          <p className="relative z-10 mb-4 text-sm text-gray-400">
            Switch between dark and light mode. Saved on this device.
          </p>
          <div className="relative z-10">
            <ThemeToggle />
          </div>
        </section>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
            <Users size={16} className="text-accent-purple" /> Household profiles
          </h2>
          <p className="relative z-10 mb-4 text-sm text-gray-400">Display names shown around the dashboard.</p>
          <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PEOPLE.map((p) => (
              <div key={p.key}>
                <label className="mb-1 block text-xs text-gray-500">{p.label}&rsquo;s display name</label>
                <input
                  value={names[p.key] ?? p.label}
                  onChange={(e) => setNames((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
            <Bell size={16} className="text-accent-blue" /> Notifications
          </h2>
          <p className="relative z-10 mb-4 text-sm text-gray-400">
            Preferences save now — actual delivery goes live once the backend is wired up.
          </p>
          <div className="relative z-10 space-y-3">
            {NOTIF_ROWS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between text-sm text-gray-200">
                {label}
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-pressed={notif[key]}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    notif[key] ? "bg-accent-purple" : "bg-base-card"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      notif[key] ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
            <ShieldCheck size={16} className="text-accent-green" /> Security
          </h2>
          <p className="relative z-10 text-sm text-gray-400">
            Enable authenticator-app MFA here once accounts exist — see SECURITY.md §1. Login lockout and audit log
            are already active at the database level regardless of this screen.
          </p>
        </section>
      </main>
    </div>
  );
}
