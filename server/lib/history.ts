import type { PrismaClient, Task, TaskStatus } from "@prisma/client";
import { nextPosition } from "@/server/lib/guards";

/** Prisma root client or interactive-transaction client. */
export type HistoryDb = Pick<PrismaClient, "task" | "taskStatusChange" | "sprint" | "projectMember" | "label">;

/**
 * Append one row to the task status history. Always call it inside the same
 * transaction as the change it describes, so history and state cannot diverge.
 *
 * `sprintId` is the sprint the task was in when the change happened. A change
 * TO "BACKLOG" with a sprintId means the task left that sprint.
 */
export function recordStatusChange(
  db: Pick<PrismaClient, "taskStatusChange">,
  e: {
    taskId: string;
    projectId: string;
    sprintId: string | null;
    from: TaskStatus | null;
    to: TaskStatus;
    userId: string;
  }
) {
  if (e.from === e.to && e.from !== null) return Promise.resolve(null); // nothing changed
  return db.taskStatusChange.create({
    data: {
      taskId: e.taskId,
      projectId: e.projectId,
      sprintId: e.sprintId,
      fromStatus: e.from,
      toStatus: e.to,
      changedById: e.userId,
    },
  });
}

/**
 * Put a task into `sprintId` (status TODO, bottom of the column) or back into the
 * backlog (`null`, status BACKLOG), recording the history rows that describe it.
 * `sprintId` must already be validated as belonging to the task's project.
 */
export async function setTaskSprint(
  tx: HistoryDb,
  task: Pick<Task, "id" | "projectId" | "sprintId" | "status">,
  sprintId: string | null,
  userId: string
): Promise<void> {
  const newStatus: TaskStatus = sprintId ? "TODO" : "BACKLOG";
  const base = { taskId: task.id, projectId: task.projectId, userId };

  if (task.sprintId && task.sprintId !== sprintId) {
    // leaves its current sprint
    await recordStatusChange(tx, { ...base, sprintId: task.sprintId, from: task.status, to: "BACKLOG" });
  }
  if (sprintId) {
    const reopened = task.sprintId === sprintId;
    await recordStatusChange(tx, {
      ...base,
      sprintId,
      from: reopened ? task.status : "BACKLOG",
      to: "TODO",
    });
  } else if (!task.sprintId) {
    // backlog -> backlog: only a status change if it somehow had another status
    await recordStatusChange(tx, { ...base, sprintId: null, from: task.status, to: "BACKLOG" });
  }

  const position = await nextPosition(tx, task.projectId, sprintId, newStatus);
  await tx.task.update({
    where: { id: task.id, projectId: task.projectId },
    data: { sprintId, status: newStatus, position },
  });
}
