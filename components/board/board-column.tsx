"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/board/task-card";
import type { TaskWithRelations } from "@/types";

export function BoardColumn({
  id,
  title,
  tasks,
  onAddTask,
  onTaskClick,
}: {
  id: string;
  title: string;
  tasks: TaskWithRelations[];
  onAddTask: () => void;
  onTaskClick: (task: TaskWithRelations) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between px-0.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {title}
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
            {tasks.length}
          </span>
        </h3>
        <button
          onClick={onAddTask}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={`Add task to ${title}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-xl border border-transparent p-2 transition-colors min-h-[120px]",
          isOver && "border-indigo-200 bg-indigo-50/50"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-300">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
