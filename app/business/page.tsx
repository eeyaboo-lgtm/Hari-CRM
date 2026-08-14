"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Plus, X } from "lucide-react";

const PROJECTS = [
  { name: "ShelfPulse", url: "https://shelfpulse-j820.onrender.com/", type: "SaaS product" },
  { name: "RetailSuite", url: "https://retailsuite.onrender.com/", type: "SaaS product" },
  { name: "Dino History World", url: "https://dinohistory.onrender.com/", type: "Content site" },
];

type Idea = { id: string; text: string; status: "new" | "exploring" | "shipped" };

const STATUS_ORDER: Idea["status"][] = ["new", "exploring", "shipped"];
const STATUS_STYLE: Record<Idea["status"], string> = {
  new: "bg-accent-blue/20 text-accent-blue",
  exploring: "bg-accent-orange/20 text-accent-orange",
  shipped: "bg-accent-green/20 text-accent-green",
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function BusinessPage() {
  const [ideas, setIdeas] = useLocalStorage<Idea[]>("business.ideas", []);
  const [text, setText] = useState("");

  const addIdea = () => {
    if (!text.trim()) return;
    setIdeas((prev) => [...prev, { id: uid(), text: text.trim(), status: "new" }]);
    setText("");
  };
  const cycleStatus = (id: string) => {
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: STATUS_ORDER[(STATUS_ORDER.indexOf(i.status) + 1) % STATUS_ORDER.length] } : i
      )
    );
  };
  const removeIdea = (id: string) => setIdeas((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="flex min-h-screen bg-base-bg">
      <Sidebar />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Business Projects</h1>
          <p className="mt-1 text-sm text-gray-400">
            Sites, stores, socials, and the idea journal — backed by business_projects, business_accounts,
            business_ideas in schema.sql.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROJECTS.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card block rounded-xl2 p-5 transition-colors hover:bg-white/[0.06]"
            >
              <p className="relative z-10 text-xs uppercase tracking-wide text-gray-500">{p.type}</p>
              <h2 className="relative z-10 mt-1 font-medium text-white">{p.name}</h2>
              <p className="relative z-10 mt-1 truncate text-xs text-accent-blue">{p.url}</p>
            </a>
          ))}
        </div>

        <section className="glass-card rounded-xl2 p-5">
          <h2 className="relative z-10 mb-3 font-medium text-white">Idea journal</h2>
          <div className="relative z-10 mb-4 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addIdea()}
              placeholder="Capture a new idea..."
              className="min-w-0 flex-1 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent-purple"
            />
            <button type="button" onClick={addIdea} className="flex items-center gap-1 rounded-xl bg-accent-purple px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="relative z-10 space-y-2">
            {ideas.length === 0 && (
              <p className="text-xs text-gray-500">No ideas logged yet — click a status pill to cycle new → exploring → shipped.</p>
            )}
            {ideas.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl bg-base-card/60 px-3 py-2 text-sm">
                <p className="text-gray-200">{i.text}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cycleStatus(i.id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[i.status]}`}
                  >
                    {i.status}
                  </button>
                  <button type="button" onClick={() => removeIdea(i.id)} className="text-gray-500 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
