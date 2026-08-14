import Sidebar from "@/components/Sidebar";

const PROJECTS = [
  { name: "ShelfPulse", url: "https://shelfpulse-j820.onrender.com/", type: "SaaS product" },
  { name: "RetailSuite", url: "https://retailsuite.onrender.com/", type: "SaaS product" },
  { name: "Dino History World", url: "https://dinohistory.onrender.com/", type: "Content site" },
];

export default function BusinessPage() {
  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Business Projects</h1>
        <p className="text-sm text-gray-400">
          Sites, stores, socials, and the idea journal — backed by
          business_projects, business_accounts, business_ideas in schema.sql.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROJECTS.map((p) => (
            <div key={p.name} className="rounded-xl2 bg-base-panel p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">{p.type}</p>
              <h2 className="mt-1 font-medium text-white">{p.name}</h2>
              <p className="mt-1 truncate text-xs text-accent-blue">{p.url}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl2 bg-base-panel p-5">
          <h2 className="mb-2 font-medium text-white">Idea journal</h2>
          <p className="text-xs text-gray-500">Next up: freeform idea capture with tags/status.</p>
        </div>
      </main>
    </div>
  );
}
