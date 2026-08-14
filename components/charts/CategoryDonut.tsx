"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

// Placeholder split across life segments — swap for a real aggregate query
// (e.g. % of open action items per segment) once modules are live.
const data = [
  { name: "Finance", value: 45, color: "#38bdf8" },
  { name: "Health", value: 25, color: "#f472b6" },
  { name: "Business", value: 20, color: "#7c6cf6" },
  { name: "Other", value: 10, color: "#34d399" },
];

export default function CategoryDonut() {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={70}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-white">
          {data[0].value}%
        </span>
      </div>
    </div>
  );
}
