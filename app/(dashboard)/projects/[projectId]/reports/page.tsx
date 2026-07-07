"use client";

import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { ProjectHeader } from "@/components/project/project-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BurndownChart } from "@/components/reports/burndown-chart";
import { CumulativeFlowChart } from "@/components/reports/cfd-chart";
import { CompletionRate } from "@/components/reports/completion-rate";
import { WorkloadChart } from "@/components/team/workload-chart";
import { ExportPdfButton } from "@/components/reports/export-pdf-button";

export default function ReportsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: sprint, isLoading } = trpc.sprint.active.useQuery({ projectId });
  const { data: sprints } = trpc.sprint.list.useQuery({ projectId });
  const mostRecentSprint = sprint ?? sprints?.find((s) => s.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <ProjectHeader
        title="Reports"
        description="Sprint health and team performance at a glance."
        action={<ExportPdfButton targetRef={reportRef} fileName="agileboard-report" />}
      />

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {!isLoading && !mostRecentSprint && (
        <Card className="p-10 text-center text-sm text-slate-500">
          No sprint data yet — start a sprint to see reports.
        </Card>
      )}

      {!isLoading && mostRecentSprint && (
        <div ref={reportRef} className="space-y-6 bg-white">
          <BurndownChart projectId={projectId} sprintId={mostRecentSprint.id} />
          <CumulativeFlowChart projectId={projectId} sprintId={mostRecentSprint.id} />
          <CompletionRate projectId={projectId} />
          <WorkloadChart projectId={projectId} />
        </div>
      )}
    </div>
  );
}
