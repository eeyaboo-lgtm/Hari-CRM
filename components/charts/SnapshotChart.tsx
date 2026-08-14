"use client";

import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from "recharts";

// Placeholder data — swap for a real query against finance_transactions
// (grouped by month) once the Supabase project is live.
const data = [
  { month: "Mar", value: 4200 },
  { month: "Apr", value: 9800 },
  { month: "May", value: 3100 },
  { month: "Jun", value: 8600 },
  { month: "Jul", value: 6200 },
  { month: "Aug", value: 7100 },
];

export default function SnapshotChart() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data}>
        <XAxis
          dataKey="month"
          stroke="#6b7280"
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <Tooltip
          contentStyle={{
            background: "#20222e",
            border: "1px solid #2a2d3a",
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#f9fafb"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
