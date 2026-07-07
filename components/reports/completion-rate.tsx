"use client";

import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CompletionRate({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.report.completionRate.useQuery({ projectId });

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Completion rate</h3>
      <p className="mb-4 text-xs text-slate-500">Share of assigned tasks each member has completed</p>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">No assigned tasks yet.</p>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((m) => (
            <div key={m.userId}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{m.name}</span>
                <span className="text-slate-400">
                  {m.completed}/{m.total} · {m.rate}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${m.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
