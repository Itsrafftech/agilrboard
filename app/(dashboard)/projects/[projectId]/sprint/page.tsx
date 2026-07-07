"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, PlayCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ProjectHeader } from "@/components/project/project-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/board/priority-badge";
import { CreateSprintModal } from "@/components/sprint/create-sprint-modal";
import { VelocityChart } from "@/components/sprint/velocity-chart";
import { formatDate } from "@/lib/utils";
import { SPRINT_STATUS_LABELS } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-slate-100 text-slate-500",
};

export default function SprintPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [createOpen, setCreateOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: sprints, isLoading } = trpc.sprint.list.useQuery({ projectId });
  const { data: activeSprint } = trpc.sprint.active.useQuery({ projectId });

  const startSprint = trpc.sprint.start.useMutation({
    onSuccess: () => {
      toast.success("Sprint started");
      utils.sprint.list.invalidate({ projectId });
      utils.sprint.active.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const completeSprint = trpc.sprint.complete.useMutation({
    onSuccess: () => {
      toast.success("Sprint completed");
      utils.sprint.list.invalidate({ projectId });
      utils.sprint.active.invalidate({ projectId });
      utils.sprint.velocity.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const removeFromSprint = trpc.task.removeFromSprint.useMutation({
    onSuccess: () => {
      toast.success("Moved back to backlog");
      utils.sprint.active.invalidate({ projectId });
      utils.task.backlog.invalidate({ projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const planned = sprints?.filter((s) => s.status === "PLANNED") ?? [];
  const completed = sprints?.filter((s) => s.status === "COMPLETED") ?? [];
  const hasActive = !!activeSprint;

  const committedPoints = activeSprint?.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0) ?? 0;
  const completedPoints =
    activeSprint?.tasks
      .filter((t) => t.status === "DONE")
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <ProjectHeader
        title="Sprint planning"
        description="Plan sprints and track progress toward the sprint goal."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New sprint
          </Button>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {activeSprint ? (
            <Card className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{activeSprint.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE.ACTIVE}`}>
                      Active
                    </span>
                  </div>
                  {activeSprint.goal && <p className="mt-1 text-sm text-slate-500">{activeSprint.goal}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => completeSprint.mutate({ projectId, sprintId: activeSprint.id })}
                  loading={completeSprint.isLoading}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Complete sprint
                </Button>
              </div>

              <p className="mb-3 text-xs font-medium text-slate-500">
                {completedPoints} / {committedPoints} story points complete
              </p>

              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {activeSprint.tasks.length === 0 && (
                  <p className="p-4 text-center text-sm text-slate-400">
                    No tasks in this sprint yet — add some from the Backlog.
                  </p>
                )}
                {activeSprint.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{task.title}</span>
                    {task.storyPoints != null && (
                      <span className="text-xs text-slate-400">{task.storyPoints} pts</span>
                    )}
                    <PriorityBadge priority={task.priority} />
                    {task.assignee && (
                      <Avatar name={task.assignee.name} email={task.assignee.email} image={task.assignee.image} size="xs" />
                    )}
                    <button
                      onClick={() => removeFromSprint.mutate({ projectId, taskId: task.id })}
                      className="text-xs font-medium text-slate-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-sm text-slate-500">No active sprint.</p>
              {planned.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">Start one of your planned sprints below.</p>
              )}
            </Card>
          )}

          {planned.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Planned sprints</h3>
              <Card className="divide-y divide-slate-100">
                {planned.map((sprint) => (
                  <div key={sprint.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{sprint.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)} · {sprint._count.tasks} tasks
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={hasActive}
                      loading={startSprint.isLoading}
                      onClick={() => startSprint.mutate({ projectId, sprintId: sprint.id })}
                      title={hasActive ? "Complete the active sprint first" : undefined}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Start
                    </Button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          <VelocityChart projectId={projectId} />

          {completed.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Completed sprints</h3>
              <Card className="divide-y divide-slate-100">
                {completed.map((sprint) => (
                  <div key={sprint.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{sprint.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)} · {sprint._count.tasks} tasks
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE.COMPLETED}`}>
                      {SPRINT_STATUS_LABELS.COMPLETED}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      <CreateSprintModal
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        nextSprintNumber={(sprints?.length ?? 0) + 1}
      />
    </div>
  );
}
