"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ProjectHeader } from "@/components/project/project-header";
import { KanbanBoard } from "@/components/board/kanban-board";
import { BoardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TaskStatus, TaskWithRelations } from "@/types";

type BoardTask = TaskWithRelations & { status: TaskStatus };

export default function BoardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [assigneeId, setAssigneeId] = useState<string>("all");

  const { data: sprint, isLoading: sprintLoading } = trpc.sprint.active.useQuery({ projectId });
  const { data: project, isLoading: projectLoading } = trpc.project.get.useQuery({ projectId });

  const isLoading = sprintLoading || projectLoading;

  const members = project?.projectMembers.map((m) => m.user) ?? [];
  const labels = project?.labels ?? [];

  const visibleTasks = (sprint?.tasks ?? [])
    .filter((t) => t.status !== "BACKLOG")
    .filter((t) => assigneeId === "all" || t.assigneeId === assigneeId) as BoardTask[];

  return (
    <div className="px-6 py-8">
      <ProjectHeader
        title="Board"
        description={sprint ? `${sprint.name}${sprint.goal ? ` — ${sprint.goal}` : ""}` : undefined}
        action={
          !isLoading &&
          project && (
            <Select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-48"
            >
              <option value="all">All assignees</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </Select>
          )
        }
      />

      {isLoading && <BoardSkeleton />}

      {!isLoading && !sprint && (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-500">No active sprint yet.</p>
          <p className="mt-1 text-sm text-slate-400">Start a sprint to see its board here.</p>
          <Link href={`/projects/${projectId}/sprint`}>
            <Button className="mt-4">Go to sprint planning</Button>
          </Link>
        </Card>
      )}

      {!isLoading && sprint && project && (
        <KanbanBoard
          projectId={projectId}
          sprintId={sprint.id}
          tasks={visibleTasks}
          members={members}
          labels={labels}
        />
      )}
    </div>
  );
}
