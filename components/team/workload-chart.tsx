"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkloadChart({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.report.workload.useQuery({ projectId });

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Team workload</h3>
      <p className="mb-4 text-xs text-slate-500">Open tasks and story points assigned per member</p>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && data && data.length > 0 && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="taskCount" name="Open tasks" fill="#818cf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="storyPoints" name="Story points" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No members yet.</p>
      )}
    </Card>
  );
}
