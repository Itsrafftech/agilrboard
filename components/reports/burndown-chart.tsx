"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BurndownChart({ projectId, sprintId }: { projectId: string; sprintId: string }) {
  const { data, isLoading } = trpc.report.burndown.useQuery({ projectId, sprintId });

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Burndown</h3>
      <p className="mb-4 text-xs text-slate-500">Remaining story points vs. the ideal pace</p>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && data && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#cbd5e1" strokeDasharray="4 4" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="#4f46e5" dot={{ r: 2 }} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
