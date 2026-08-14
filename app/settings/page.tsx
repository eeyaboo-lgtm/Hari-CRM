import Sidebar from "@/components/Sidebar";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <div className="rounded-xl2 bg-base-panel p-5">
          <h2 className="mb-2 font-medium text-white">Security</h2>
          <p className="text-sm text-gray-400">
            Enable authenticator-app MFA here once accounts exist — see
            SECURITY.md §1. Login lockout and audit log are already active at
            the database level regardless of this screen.
          </p>
        </div>
      </main>
    </div>
  );
}
