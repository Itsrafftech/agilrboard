"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { trpc } from "@/lib/trpc";
import { BoardColumn } from "@/components/board/board-column";
import { TaskCard } from "@/components/board/task-card";
import { TaskModal } from "@/components/board/task-modal";
import { TASK_STATUSES } from "@/types";
import type { TaskStatus, TaskWithRelations } from "@/types";

type BoardTask = TaskWithRelations & { status: TaskStatus };

export function KanbanBoard({
  projectId,
  sprintId,
  tasks,
  members,
  labels,
}: {
  projectId: string;
  sprintId: string;
  tasks: BoardTask[];
  members: { id: string; name: string | null; email: string }[];
  labels: { id: string; name: string; color: string }[];
}) {
  const [items, setItems] = useState(tasks);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [modalState, setModalState] = useState<
    | { mode: "create"; status: TaskStatus }
    | { mode: "edit"; task: BoardTask }
    | null
  >(null);

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const utils = trpc.useUtils();
  const move = trpc.task.move.useMutation({
    onSettled: () => {
      utils.sprint.active.invalidate({ projectId });
      utils.report.cumulativeFlow.invalidate();
      utils.report.burndown.invalidate();
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function columnTasks(status: TaskStatus) {
    return items.filter((t) => t.status === status).sort((a, b) => a.position - b.position);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = items.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeTask = items.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overIsColumn = TASK_STATUSES.some((s) => s.value === over.id);
    const targetStatus: TaskStatus = overIsColumn
      ? (over.id as TaskStatus)
      : items.find((t) => t.id === over.id)?.status ?? activeTask.status;

    const targetColumn = columnTasks(targetStatus).filter((t) => t.id !== activeTask.id);
    let targetIndex = targetColumn.length;
    if (!overIsColumn) {
      const overIndex = targetColumn.findIndex((t) => t.id === over.id);
      if (overIndex !== -1) targetIndex = overIndex;
    }

    targetColumn.splice(targetIndex, 0, { ...activeTask, status: targetStatus });

    setItems((prev) => {
      const others = prev.filter((t) => t.status !== targetStatus && t.id !== activeTask.id);
      const reindexed = targetColumn.map((t, idx) => ({ ...t, position: idx }));
      return [...others, ...reindexed];
    });

    move.mutate({ projectId, taskId: activeTask.id, status: targetStatus, position: targetIndex });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES.map((col) => (
            <BoardColumn
              key={col.value}
              id={col.value}
              title={col.label}
              tasks={columnTasks(col.value)}
              onAddTask={() => setModalState({ mode: "create", status: col.value })}
              onTaskClick={(task) => setModalState({ mode: "edit", task: task as BoardTask })}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <TaskModal
        open={modalState?.mode === "create"}
        onClose={() => setModalState(null)}
        projectId={projectId}
        members={members}
        labels={labels}
        defaultStatus={modalState?.mode === "create" ? modalState.status : undefined}
        defaultSprintId={sprintId}
      />
      <TaskModal
        open={modalState?.mode === "edit"}
        onClose={() => setModalState(null)}
        projectId={projectId}
        members={members}
        labels={labels}
        task={modalState?.mode === "edit" ? modalState.task : undefined}
      />
    </>
  );
}
