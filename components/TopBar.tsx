"use client";

import { Search, Bell } from "lucide-react";
import { useState } from "react";

const PEOPLE = [
  { key: "shenaal", name: "Shenaal", initial: "S" },
  { key: "shalini", name: "Shalini", initial: "S" },
];

export default function TopBar() {
  const [activePerson, setActivePerson] = useState(PEOPLE[0]);

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Hello, {activePerson.name}</h1>
        <p className="text-sm text-gray-400">Welcome back!</p>
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <div className="glass-card flex w-full max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm text-gray-400">
          <span className="relative z-10 flex items-center gap-2">
            <Search size={16} />
            <span>Search</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="glass-card rounded-full p-2.5 text-gray-300 hover:text-white">
          <Bell size={18} className="relative z-10" />
        </button>

        {/* Household switcher — replaces the single-user avatar in the reference design.
            Backed by auth once wired up; for now toggles which person's "private" data
            is in view (shared/mirrored items always show regardless of who's active). */}
        <div className="glass-card flex items-center gap-1 rounded-full p-1">
          {PEOPLE.map((person) => (
            <button
              key={person.key}
              onClick={() => setActivePerson(person)}
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                activePerson.key === person.key
                  ? "glossy-gradient bg-gradient-to-br from-accent-purple to-accent-pink text-white shadow-glow-purple"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title={person.name}
            >
              <span className="relative z-10">{person.initial}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
