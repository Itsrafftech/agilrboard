"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus, TaskWithRelations } from "@/types";

type Member = { id: string; name: string | null; email: string };
type ProjectLabel = { id: string; name: string; color: string };

export function TaskModal({
  open,
  onClose,
  projectId,
  members,
  labels,
  task,
  defaultStatus,
  defaultSprintId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  members: Member[];
  labels: ProjectLabel[];
  task?: TaskWithRelations & { status: TaskStatus };
  defaultStatus?: TaskStatus;
  defaultSprintId?: string | null;
}) {
  const isEditing = !!task;
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssigneeId(task.assigneeId ?? "");
      setPriority(task.priority);
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
      setStoryPoints(task.storyPoints != null ? String(task.storyPoints) : "");
      setLabelIds(task.labels.map((l) => l.id));
    } else {
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setPriority("MEDIUM");
      setDueDate("");
      setStoryPoints("");
      setLabelIds([]);
    }
  }, [open, task]);

  function invalidateAll() {
    utils.task.list.invalidate({ projectId });
    utils.task.backlog.invalidate({ projectId });
    utils.sprint.active.invalidate({ projectId });
    utils.report.workload.invalidate({ projectId });
    utils.report.completionRate.invalidate({ projectId });
  }

  const create = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      invalidateAll();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const update = trpc.task.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      invalidateAll();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      invalidateAll();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const points = storyPoints ? parseInt(storyPoints, 10) : undefined;
    const due = dueDate ? new Date(dueDate) : undefined;

    if (isEditing) {
      update.mutate({
        projectId,
        taskId: task.id,
        title,
        description: description || null,
        priority,
        assigneeId: assigneeId || null,
        dueDate: due ?? null,
        storyPoints: points ?? null,
        labelIds,
      });
    } else {
      create.mutate({
        projectId,
        title,
        description: description || undefined,
        priority,
        status: defaultStatus ?? "TODO",
        assigneeId: assigneeId || undefined,
        dueDate: due,
        storyPoints: points,
        sprintId: defaultSprintId ?? null,
        labelIds,
      });
    }
  }

  const loading = create.isLoading || update.isLoading || remove.isLoading;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit task" : "New task"} className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-desc">Description</Label>
          <Textarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add more detail…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">Assignee</Label>
            <Select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-points">Story points</Label>
            <Input
              id="task-points"
              type="number"
              min={0}
              max={100}
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
        </div>

        {labels.length > 0 && (
          <div className="space-y-1.5">
            <Label>Labels</Label>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => {
                const active = labelIds.includes(label.id);
                return (
                  <button
                    type="button"
                    key={label.id}
                    onClick={() =>
                      setLabelIds((prev) =>
                        active ? prev.filter((id) => id !== label.id) : [...prev, label.id]
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active ? "text-white" : "bg-white text-slate-500 border-slate-200"
                    )}
                    style={active ? { backgroundColor: label.color, borderColor: label.color } : undefined}
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {isEditing ? (
            <button
              type="button"
              onClick={() => remove.mutate({ projectId, taskId: task.id })}
              className="text-sm font-medium text-red-500 hover:text-red-600"
            >
              Delete task
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {isEditing ? "Save changes" : "Create task"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
