"use client";

import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from "recharts";

export type SnapshotPoint = { month: string; value: number };

export default function SnapshotChart({ data }: { data: SnapshotPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-xs text-gray-500">
        No recurring bills yet — add loans/subscriptions in Finance to see a projection here.
      </div>
    );
  }
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
