"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export type CategorySlice = { name: string; value: number; color: string };

export default function CategoryDonut({ data }: { data: CategorySlice[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-center text-xs text-gray-500">
        No committed spending yet — add loans, subscriptions, or payment schemes in Finance.
      </div>
    );
  }
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
        <span className="text-[10px] text-gray-500">{data[0].name}</span>
      </div>
    </div>
  );
}
