"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Layers } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { PriorityBadge } from "@/components/board/priority-badge";
import { Avatar } from "@/components/ui/avatar";
import type { TaskWithRelations } from "@/types";

export function TaskCard({
  task,
  onClick,
}: {
  task: TaskWithRelations;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue =
    task.dueDate && task.status !== "DONE" && new Date(task.dueDate).getTime() < Date.now();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{task.title}</p>
      </div>

      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${label.color}1a`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        {task.assignee && (
          <Avatar name={task.assignee.name} email={task.assignee.email} image={task.assignee.image} size="xs" />
        )}
      </div>

      {(task.dueDate || task.storyPoints != null) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
          {task.dueDate && (
            <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-500")}>
              <CalendarDays className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.storyPoints != null && (
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {task.storyPoints} pts
            </span>
          )}
        </div>
      )}
    </div>
  );
}
