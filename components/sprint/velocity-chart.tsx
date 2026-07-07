"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function VelocityChart({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.sprint.velocity.useQuery({ projectId });

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Sprint velocity</h3>
      <p className="mb-4 text-xs text-slate-500">Committed vs. completed story points per sprint</p>

      {isLoading && <Skeleton className="h-56 w-full" />}

      {!isLoading && data && data.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">
          No completed sprints yet — velocity appears here once a sprint finishes.
        </p>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="committed" name="Committed" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
