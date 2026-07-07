"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "#e2e8f0",
  TODO: "#c7d2fe",
  IN_PROGRESS: "#818cf8",
  IN_REVIEW: "#f59e0b",
  DONE: "#22c55e",
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export function CumulativeFlowChart({ projectId, sprintId }: { projectId: string; sprintId: string }) {
  const { data, isLoading } = trpc.report.cumulativeFlow.useQuery({ projectId, sprintId });

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Cumulative flow</h3>
      <p className="mb-4 text-xs text-slate-500">Task counts by status across the sprint</p>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && data && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => STATUS_LABELS[value] ?? value}
              />
              {(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map((status) => (
                <Area
                  key={status}
                  type="monotone"
                  dataKey={status}
                  stackId="1"
                  stroke={STATUS_COLORS[status]}
                  fill={STATUS_COLORS[status]}
                  fillOpacity={0.8}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
