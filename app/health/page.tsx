import Sidebar from "@/components/Sidebar";

export default function HealthPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Health & Insurance</h1>
        <p className="text-sm text-gray-400">
          Records, appointments, and log notes — backed by health_records,
          health_appointments, health_log_notes in schema.sql. Documents upload
          to a private storage bucket with signed-URL access only (SECURITY.md §4).
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {["Conditions & history", "Appointments", "Log notes"].map((title) => (
            <div key={title} className="rounded-xl2 bg-base-panel p-5">
              <h2 className="mb-2 font-medium text-white">{title}</h2>
              <p className="text-xs text-gray-500">Next up: build the CRUD form for this section.</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
