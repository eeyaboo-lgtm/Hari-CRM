"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useHousehold } from "@/lib/HouseholdContext";
import { createClient } from "@/lib/supabase/client";
import { setAdminViewingHousehold, getAdminViewingHouseholdId } from "@/lib/supabase/ownerMap";
import { adminResetPassword, listHouseholdLogins } from "@/app/settings/actions";
import TwoFactorSettings from "@/components/TwoFactorSettings";
import HouseholdInvites from "@/components/HouseholdInvites";
import AdminHouseholdOverview from "@/components/AdminHouseholdOverview";
import { Bell, Building2, Check, Key, Lock, Plus, Rocket, RotateCcw, Trash2, Users } from "lucide-react";
import { QUICK_LAUNCH_STORAGE_KEY, DEFAULT_QUICK_LAUNCH, QUICK_LAUNCH_SWATCH, type QuickLaunchColor, type QuickLaunchItem } from "@/lib/quickLaunch";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const QUICK_LAUNCH_COLORS: QuickLaunchColor[] = ["pink", "blue", "purple", "green", "orange"];

// Read-only Business project list, so a Quick Launch shortcut can point at
// a specific project instead of a hand-typed URL. Deliberately not
// useSupabaseSynced (this section never writes to business_projects) —
// same "plain read-only fetch" pattern as lib/supabase/useFxRates.ts.
function useBusinessProjectOptions() {
  const [options, setOptions] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("business_projects").select("name,url");
      if (!cancelled && !error && data) setOptions(data as { name: string; url: string }[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

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

type HouseholdRow = { id: string; name: string; slug: string };

function AdminHouseholdSwitcher() {
  const { refreshHousehold } = useHousehold();
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("households").select("id, name, slug").order("name");
      if (!error && data) setHouseholds(data as HouseholdRow[]);
      setCurrent(getAdminViewingHouseholdId() ?? "");
      setLoading(false);
    })();
  }, []);

  const pick = async (id: string) => {
    setCurrent(id);
    setAdminViewingHousehold(id || null);
    await refreshHousehold();
  };

  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
        <Building2 size={16} className="text-accent-orange" /> Admin — viewing household
      </h2>
      <p className="relative z-10 mb-4 text-sm text-gray-400">
        You're signed in as admin, which has no household data of its own. Pick a household below to view and
        edit its dashboard on their behalf — every other page will show their data until you switch or sign out.
      </p>
      <div className="relative z-10">
        {loading ? (
          <p className="text-xs text-gray-500">Loading households...</p>
        ) : (
          <select
            value={current}
            onChange={(e) => pick(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
          >
            <option value="">Choose a household...</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
}

type LoginRow = { householdId: string; householdName: string; userId: string; email: string; displayName: string };

function AdminAccountRecovery() {
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [forcePin, setForcePin] = useState(true);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    listHouseholdLogins()
      .then(setLogins)
      .catch(() => setLogins([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const reset = async (row: LoginRow) => {
    if (newPw.length < 6) {
      setMsg((m) => ({ ...m, [row.userId]: "Must be at least 6 characters" }));
      return;
    }
    setBusy(true);
    const res = await adminResetPassword(row.userId, newPw, forcePin);
    setBusy(false);
    setMsg((m) => ({ ...m, [row.userId]: res.ok ? "Done — give them the new one to sign in with" : res.error }));
    if (res.ok) {
      setNewPw("");
      setTimeout(() => setOpenFor(null), 1200);
    }
  };

  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
        <RotateCcw size={16} className="text-accent-pink" /> Admin — reset a household's login
      </h2>
      <p className="relative z-10 mb-4 text-sm text-gray-400">
        If someone's locked out, set a one-time password/PIN here and pass it along. With "force PIN setup"
        checked, they'll be required to set their own PIN (or password) the moment they sign in with it — same
        forced first-launch flow as a brand new account.
      </p>
      <div className="relative z-10 space-y-2">
        {loading && <p className="text-xs text-gray-500">Loading logins...</p>}
        {!loading &&
          logins.map((row) => (
            <div key={row.userId} className="rounded-xl bg-base-card/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-200">
                    {row.householdName} <span className="text-xs text-gray-500">— {row.displayName}</span>
                  </p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenFor(openFor === row.userId ? null : row.userId)}
                  className="rounded-lg border border-base-border px-2.5 py-1 text-xs text-gray-300 hover:border-accent-purple hover:text-white"
                >
                  Reset password
                </button>
              </div>
              {openFor === row.userId && (
                <div className="mt-2 space-y-2 border-t border-base-border pt-2">
                  <input
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="One-time password / PIN (6+ chars)"
                    className="w-full max-w-xs rounded-lg border border-base-border bg-base-card px-2.5 py-1.5 text-xs text-gray-100 outline-none focus:border-accent-purple"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-400">
                    <input type="checkbox" checked={forcePin} onChange={(e) => setForcePin(e.target.checked)} />
                    Force PIN setup on next sign-in
                  </label>
                  {msg[row.userId] && <p className="text-xs text-accent-orange">{msg[row.userId]}</p>}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reset(row)}
                    className="rounded-lg bg-accent-purple px-2.5 py-1 text-xs text-white disabled:opacity-50"
                  >
                    Confirm reset
                  </button>
                </div>
              )}
            </div>
          ))}
        {!loading && logins.length === 0 && <p className="text-xs text-gray-500">No household logins found.</p>}
      </div>
    </section>
  );
}

function SignInCredentialManager() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg("");
    if (newPw.length < 6) {
      setMsg("New password/PIN must be at least 6 characters");
      return;
    }
    if (newPw !== confirmPw) {
      setMsg("New values don't match");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) throw new Error("no session");
      // Re-verify identity with the current password before changing it.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (reauthErr) {
        setMsg("Current password/PIN is wrong");
        setBusy(false);
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) throw updateErr;
      setMsg("Updated");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      console.error("[SignInCredentialManager] update failed", err);
      setMsg("Couldn't update — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-card rounded-xl2 p-5">
      <h2 className="relative z-10 mb-1 flex items-center gap-2 font-medium text-white">
        <Key size={16} className="text-accent-blue" /> Sign-in password / PIN
      </h2>
      <p className="relative z-10 mb-4 text-sm text-gray-400">
        This is your real sign-in credential (what you type at the login screen) — different from the optional
        per-profile quick-unlock PIN below.
      </p>
      <div className="relative z-10 grid max-w-md gap-2">
        <input
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          placeholder="Current password / PIN"
          className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder="New password / PIN"
          className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          placeholder="Confirm new password / PIN"
          className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
        />
        {msg && <p className="text-xs text-accent-orange">{msg}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex w-fit items-center gap-1.5 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          <Check size={14} /> Update
        </button>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { members, addMember, removeMember, renameMember, isAdmin, householdId } = useHousehold();
  const [newName, setNewName] = useState("");
  const [notif, setNotif] = useLocalStorage<Notif>("notificationPrefs", {
    emailReminders: true,
    browserAlerts: false,
    weeklyDigest: true,
  });

  const toggle = (key: keyof Notif) => setNotif((prev) => ({ ...prev, [key]: !prev[key] }));

  // Quick Launch customization (Phase 0 backlog) — per-device shortcut list
  // shown on the Dashboard. See lib/quickLaunch.ts for the shared type.
  const [quickLaunch, setQuickLaunch] = useLocalStorage<QuickLaunchItem[]>(QUICK_LAUNCH_STORAGE_KEY, DEFAULT_QUICK_LAUNCH);
  const businessProjects = useBusinessProjectOptions();
  const [newQL, setNewQL] = useState({ label: "", url: "", color: "purple" as QuickLaunchColor });
  const addQuickLaunch = () => {
    if (!newQL.label.trim() || !newQL.url.trim()) return;
    setQuickLaunch((prev) => [...prev, { id: uid(), label: newQL.label.trim(), url: newQL.url.trim(), color: newQL.color }]);
    setNewQL({ label: "", url: "", color: "purple" });
  };
  const removeQuickLaunch = (id: string) => setQuickLaunch((prev) => prev.filter((q) => q.id !== id));
  const pickBusinessProject = (name: string) => {
    const proj = businessProjects.find((p) => p.name === name);
    if (proj) setNewQL((s) => ({ ...s, label: proj.name, url: proj.url }));
  };

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>

        {isAdmin && <AdminHouseholdSwitcher />}
        {isAdmin && <AdminAccountRecovery />}
        {isAdmin && <AdminHouseholdOverview />}
        {!isAdmin && <SignInCredentialManager />}
        {!isAdmin && householdId && <HouseholdInvites householdId={householdId} />}

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
            <Rocket size={16} className="text-accent-orange" /> Quick Launch
          </h2>
          <p className="relative z-10 mb-4 text-sm text-gray-400">
            Shortcuts shown on your Dashboard. Point one at a Business project or a custom URL. Saved on this device.
          </p>
          <div className="relative z-10 space-y-2">
            {quickLaunch.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl bg-base-card/60 p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${QUICK_LAUNCH_SWATCH[q.color]}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-200">{q.label}</p>
                    <p className="truncate text-xs text-gray-500">{q.url}</p>
                  </div>
                </div>
                <button type="button" onClick={() => removeQuickLaunch(q.id)} className="shrink-0 text-gray-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {quickLaunch.length === 0 && <p className="text-xs text-gray-500">No shortcuts yet — add one below.</p>}
          </div>
          <div className="relative z-10 mt-4 space-y-2 border-t border-base-border pt-4">
            {businessProjects.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => e.target.value && pickBusinessProject(e.target.value)}
                className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple sm:w-auto"
              >
                <option value="">Prefill from a Business project...</option>
                {businessProjects.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                value={newQL.label}
                onChange={(e) => setNewQL((s) => ({ ...s, label: e.target.value }))}
                placeholder="Label"
                className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
              <input
                value={newQL.url}
                onChange={(e) => setNewQL((s) => ({ ...s, url: e.target.value }))}
                placeholder="URL"
                className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
              />
              <select
                value={newQL.color}
                onChange={(e) => setNewQL((s) => ({ ...s, color: e.target.value as QuickLaunchColor }))}
                className="rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none"
              >
                {QUICK_LAUNCH_COLORS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button type="button" onClick={addQuickLaunch} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
                <Plus size={14} /> Add
              </button>
            </div>
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

        <TwoFactorSettings />
      </main>
    </div>
  );
}
