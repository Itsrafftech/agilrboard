"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, ArrowRightCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ProjectHeader } from "@/components/project/project-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/board/priority-badge";
import { TaskModal } from "@/components/board/task-modal";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskStatus, TaskWithRelations } from "@/types";

type BacklogTask = TaskWithRelations & { status: TaskStatus };

export default function BacklogPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [modalState, setModalState] = useState<
    { mode: "create" } | { mode: "edit"; task: BacklogTask } | null
  >(null);

  const { data: tasks, isLoading } = trpc.task.backlog.useQuery({ projectId });
  const { data: project } = trpc.project.get.useQuery({ projectId });
  const { data: activeSprint } = trpc.sprint.active.useQuery({ projectId });

  const utils = trpc.useUtils();
  const addToSprint = trpc.task.addToSprint.useMutation({
    onSuccess: () => {
      toast.success("Moved to active sprint");
      utils.task.backlog.invalidate({ projectId });
      utils.sprint.active.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const members = project?.projectMembers.map((m) => m.user) ?? [];
  const labels = project?.labels ?? [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <ProjectHeader
        title="Backlog"
        description="Tasks not yet planned into a sprint."
        action={
          <Button onClick={() => setModalState({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        }
      />

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!isLoading && tasks?.length === 0 && (
        <Card className="p-10 text-center text-sm text-slate-500">Backlog is empty.</Card>
      )}

      {!isLoading && tasks && tasks.length > 0 && (
        <Card className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50"
              onClick={() => setModalState({ mode: "edit", task: task as BacklogTask })}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{task.title}</p>
                {task.labels.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {task.labels.map((l) => (
                      <span
                        key={l.id}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${l.color}1a`, color: l.color }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {task.storyPoints != null && (
                <span className="text-xs text-slate-400">{task.storyPoints} pts</span>
              )}
              <PriorityBadge priority={task.priority} />
              {task.assignee ? (
                <Avatar name={task.assignee.name} email={task.assignee.email} image={task.assignee.image} />
              ) : (
                <div className="h-7 w-7 rounded-full border border-dashed border-slate-200" />
              )}
              <button
                disabled={!activeSprint || addToSprint.isLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!activeSprint) return;
                  addToSprint.mutate({ projectId, taskId: task.id, sprintId: activeSprint.id });
                }}
                title={activeSprint ? "Add to active sprint" : "No active sprint"}
                className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowRightCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
        </Card>
      )}

      <TaskModal
        open={modalState?.mode === "create"}
        onClose={() => setModalState(null)}
        projectId={projectId}
        members={members}
        labels={labels}
        defaultStatus="BACKLOG"
        defaultSprintId={null}
      />
      <TaskModal
        open={modalState?.mode === "edit"}
        onClose={() => setModalState(null)}
        projectId={projectId}
        members={members}
        labels={labels}
        task={modalState?.mode === "edit" ? modalState.task : undefined}
      />
    </div>
  );
}
