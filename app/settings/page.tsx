"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useHousehold } from "@/lib/HouseholdContext";
import { Bell, Lock, Plus, ShieldCheck, Trash2, Users } from "lucide-react";

type Notif = { emailReminders: boolean; browserAlerts: boolean; weeklyDigest: boolean };

const NOTIF_ROWS: [keyof Notif, string][] = [
  ["emailReminders", "Email reminders for bills & appointments"],
  ["browserAlerts", "Browser alerts for shared updates"],
  ["weeklyDigest", "Weekly summary digest"],
];

function PinManager({ memberId, hasPin }: { memberId: string; hasPin: boolean }) {
  const { setPin, changePin, removePin } = useHousehold();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setMsg("");
  };

  const submit = async () => {
    if (next.length !== 6 || !/^\d{6}$/.test(next)) {
      setMsg("PIN must be exactly 6 digits");
      return;
    }
    if (next !== confirm) {
      setMsg("PINs don't match");
      return;
    }
    if (!hasPin) {
      await setPin(memberId, next);
      setMsg("PIN set");
    } else {
      const ok = await changePin(memberId, current, next);
      setMsg(ok ? "PIN updated" : "Current PIN is wrong");
      if (!ok) return;
    }
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 700);
  };

  const remove = async () => {
    const ok = await removePin(memberId, current);
    setMsg(ok ? "PIN removed" : "Current PIN is wrong");
    if (ok)
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 700);
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-base-border px-2.5 py-1 text-xs text-gray-300 hover:border-accent-purple hover:text-white"
      >
        <Lock size={12} /> {hasPin ? "Manage PIN" : "Set PIN"}
      </button>
    );

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-base-card/60 p-3">
      {hasPin && (
        <input
          value={current}
          onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Current 6-digit PIN"
          inputMode="numeric"
          className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-accent-purple"
        />
      )}
      <input
        value={next}
        onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="New 6-digit PIN"
        inputMode="numeric"
        className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-accent-purple"
      />
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="Confirm new PIN"
        inputMode="numeric"
        className="w-full rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-accent-purple"
      />
      {msg && <p className="text-xs text-accent-orange">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} className="rounded-lg bg-accent-purple px-2.5 py-1 text-xs text-white">
          Save
        </button>
        {hasPin && (
          <button type="button" onClick={remove} className="rounded-lg border border-base-border px-2.5 py-1 text-xs text-gray-300">
            Remove PIN
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { members, addMember, removeMember, renameMember } = useHousehold();
  const [newName, setNewName] = useState("");
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
          <p className="relative z-10 mb-4 text-sm text-gray-400">
            Add or remove household members, and set an optional 6-digit PIN each — like a Netflix profile lock.
            Picking a profile with a PIN set locks the app until it's entered.
          </p>
          <div className="relative z-10 space-y-3">
            {members.map((m) => (
              <div key={m.id} className="rounded-xl bg-base-card/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={m.name}
                    onChange={(e) => renameMember(m.id, e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-accent-purple"
                  />
                  <PinManager memberId={m.id} hasPin={!!m.pinHash} />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      title="Remove member"
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="relative z-10 mt-4 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  addMember(newName);
                  setNewName("");
                }
              }}
              placeholder="Add household member..."
              className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
            <button
              type="button"
              onClick={() => {
                if (!newName.trim()) return;
                addMember(newName);
                setNewName("");
              }}
              className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white"
            >
              <Plus size={14} /> Add
            </button>
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
