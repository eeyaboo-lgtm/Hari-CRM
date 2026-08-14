"use client";

import { Search, Bell } from "lucide-react";
import { useHousehold } from "@/lib/HouseholdContext";

const GRADIENTS = [
  "from-accent-purple to-accent-blue",
  "from-accent-pink to-accent-orange",
  "from-accent-blue to-accent-green",
  "from-accent-orange to-accent-pink",
];

export default function TopBar() {
  const { members, activeMember, selectMember } = useHousehold();

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Hello, {activeMember?.name ?? "there"}</h1>
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

        {/* Household switcher — real members from Settings. Selecting someone else
            re-triggers ProfileGate (PIN pad) automatically if that member has a PIN set. */}
        <div className="glass-card flex items-center gap-1 rounded-full p-1">
          {members.map((person, i) => (
            <button
              key={person.id}
              onClick={() => selectMember(person.id)}
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                activeMember?.id === person.id
                  ? `glossy-gradient bg-gradient-to-br text-white shadow-glow-purple ${GRADIENTS[i % GRADIENTS.length]}`
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
