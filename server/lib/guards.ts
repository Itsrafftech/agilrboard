import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { TaskStatus } from "@prisma/client";

/** Works with both the root client and an interactive-transaction client. */
export type Db = Pick<PrismaClient, "task" | "sprint" | "projectMember" | "label">;

function notFound(entity: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${entity} not found` });
}

/** Task that belongs to `projectId`, otherwise NOT_FOUND (never leaks cross-project existence). */
export async function getTaskOrThrow(db: Db, projectId: string, taskId: string) {
  const task = await db.task.findFirst({ where: { id: taskId, projectId } });
  if (!task) notFound("Task");
  return task;
}

/** Sprint that belongs to `projectId`, otherwise NOT_FOUND. */
export async function getSprintOrThrow(db: Db, projectId: string, sprintId: string) {
  const sprint = await db.sprint.findFirst({ where: { id: sprintId, projectId } });
  if (!sprint) notFound("Sprint");
  return sprint;
}

/** ProjectMember row (by member id) that belongs to `projectId`, otherwise NOT_FOUND. */
export async function getMemberOrThrow(db: Db, projectId: string, memberId: string) {
  const member = await db.projectMember.findFirst({ where: { id: memberId, projectId } });
  if (!member) notFound("Member");
  return member;
}

/**
 * Validates that every reference supplied on a task create/update points at
 * something inside the same project. `undefined` = not being changed,
 * `null` = being cleared (always allowed).
 */
export async function assertTaskRefsInProject(
  db: Db,
  projectId: string,
  refs: { assigneeId?: string | null; sprintId?: string | null; labelIds?: string[] }
) {
  if (refs.assigneeId) {
    const member = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: refs.assigneeId } },
    });
    if (!member) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee is not a member of this project" });
    }
  }

  if (refs.sprintId) {
    const sprint = await db.sprint.findFirst({ where: { id: refs.sprintId, projectId } });
    if (!sprint) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Sprint does not belong to this project" });
    }
  }

  if (refs.labelIds && refs.labelIds.length > 0) {
    const unique = Array.from(new Set(refs.labelIds));
    const count = await db.label.count({ where: { id: { in: unique }, projectId } });
    if (count !== unique.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "One or more labels do not belong to this project" });
    }
  }
}

/**
 * Runs a project-scoped Prisma write (`where: { id, projectId }`) and maps a
 * "record not found" (P2025) race — e.g. the row was deleted or moved between
 * the guard and the write — to NOT_FOUND instead of a 500.
 */
export async function scopedWrite<T>(entity: string, op: Promise<T>): Promise<T> {
  try {
    return await op;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      notFound(entity);
    }
    throw e;
  }
}

/**
 * Call BEFORE demoting or removing a member who is currently an ADMIN. Throws
 * if that member is the project's only admin. Run inside a Serializable
 * transaction so two concurrent demotions cannot both pass the check.
 */
export async function assertNotLastAdmin(db: Db, projectId: string) {
  const admins = await db.projectMember.count({ where: { projectId, role: "ADMIN" } });
  if (admins <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A project must keep at least one admin. Promote another member first.",
    });
  }
}

/**
 * Next free `position` at the bottom of one board column. A column is
 * (project, sprint-or-backlog, status) — the same scope the board orders by.
 */
export async function nextPosition(
  db: Db,
  projectId: string,
  sprintId: string | null,
  status: TaskStatus
) {
  const agg = await db.task.aggregate({
    where: { projectId, sprintId, status },
    _max: { position: true },
  });
  return (agg._max.position ?? -1) + 1;
}
