import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure, writerProcedure } from "@/server/trpc";
import { recordStatusChange, setTaskSprint } from "@/server/lib/history";
import {
  assertTaskRefsInProject,
  getSprintOrThrow,
  getTaskOrThrow,
  nextPosition,
  scopedWrite,
} from "@/server/lib/guards";

const statusSchema = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true, image: true } },
  labels: true,
} as const;

export const taskRouter = router({
  list: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findMany({
        where: {
          projectId: input.projectId,
          ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
        },
        include: taskInclude,
        orderBy: { position: "asc" },
      });
    }),

  backlog: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.task.findMany({
        where: { projectId: input.projectId, sprintId: null },
        include: taskInclude,
        orderBy: { position: "asc" },
      });
    }),

  create: writerProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        status: statusSchema.default("TODO"),
        priority: prioritySchema.default("MEDIUM"),
        assigneeId: z.string().optional(),
        dueDate: z.date().optional(),
        storyPoints: z.number().int().min(0).max(100).optional(),
        sprintId: z.string().nullable().optional(),
        labelIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sprintId && input.status === "BACKLOG") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A task in a sprint cannot have status BACKLOG" });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await assertTaskRefsInProject(tx, input.projectId, {
          assigneeId: input.assigneeId,
          sprintId: input.sprintId,
          labelIds: input.labelIds,
        });

        const sprintId = input.sprintId ?? null;
        const position = await nextPosition(tx, input.projectId, sprintId, input.status);

        const task = await tx.task.create({
          data: {
            projectId: input.projectId,
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            assigneeId: input.assigneeId,
            dueDate: input.dueDate,
            storyPoints: input.storyPoints,
            sprintId,
            creatorId: ctx.session.user.id,
            position,
            labels: input.labelIds ? { connect: input.labelIds.map((id) => ({ id })) } : undefined,
          },
          include: taskInclude,
        });

        await recordStatusChange(tx, {
          taskId: task.id,
          projectId: input.projectId,
          sprintId,
          from: null,
          to: input.status,
          userId: ctx.session.user.id,
        });
        return task;
      });
    }),

  update: writerProcedure
    .input(
      z.object({
        projectId: z.string(),
        taskId: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(5000).nullable().optional(),
        priority: prioritySchema.optional(),
        assigneeId: z.string().nullable().optional(),
        dueDate: z.date().nullable().optional(),
        storyPoints: z.number().int().min(0).max(100).nullable().optional(),
        sprintId: z.string().nullable().optional(),
        labelIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, taskId, labelIds, sprintId, ...data } = input;

      return ctx.prisma.$transaction(async (tx) => {
        const task = await getTaskOrThrow(tx, projectId, taskId);
        await assertTaskRefsInProject(tx, projectId, {
          assigneeId: data.assigneeId,
          sprintId,
          labelIds,
        });

        const updated = await scopedWrite(
          "Task",
          tx.task.update({
            where: { id: taskId, projectId },
            data: {
              ...data,
              labels: labelIds ? { set: labelIds.map((id) => ({ id })) } : undefined,
            },
            include: taskInclude,
          })
        );

        // Changing the sprint is a status event too (same rules as add/removeFromSprint).
        if (sprintId !== undefined && sprintId !== task.sprintId) {
          await scopedWrite("Task", setTaskSprint(tx, task, sprintId, ctx.session.user.id));
          return tx.task.findFirstOrThrow({ where: { id: taskId, projectId }, include: taskInclude });
        }
        return updated;
      });
    }),

  move: writerProcedure
    .input(
      z.object({
        projectId: z.string(),
        taskId: z.string(),
        status: statusSchema,
        position: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(
        async (tx) => {
          const task = await getTaskOrThrow(tx, input.projectId, input.taskId);
          if (task.sprintId && input.status === "BACKLOG") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Use removeFromSprint to send a sprint task back to the backlog",
            });
          }

          // Order only inside the destination column: same project, same sprint
          // (or the backlog when sprintId is null) and the target status.
          const siblings = await tx.task.findMany({
            where: {
              projectId: input.projectId,
              sprintId: task.sprintId,
              status: input.status,
              id: { not: task.id },
            },
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: { id: true, position: true },
          });

          const index = Math.min(input.position, siblings.length);
          const ordered = [...siblings.slice(0, index), { id: task.id, position: -1 }, ...siblings.slice(index)];

          // Only touch rows whose position actually changes. Rows that shift by the
          // same amount (the usual case: everything below the insertion point moves
          // by one) are updated with a single increment statement.
          const byDelta = new Map<number, string[]>();
          ordered.forEach((row, idx) => {
            if (row.id === task.id) return;
            const delta = idx - row.position;
            if (delta !== 0) byDelta.set(delta, [...(byDelta.get(delta) ?? []), row.id]);
          });
          for (const [delta, ids] of Array.from(byDelta.entries())) {
            await tx.task.updateMany({
              where: { id: { in: ids }, projectId: input.projectId },
              data: { position: { increment: delta } },
            });
          }

          await recordStatusChange(tx, {
            taskId: task.id,
            projectId: input.projectId,
            sprintId: task.sprintId,
            from: task.status,
            to: input.status,
            userId: ctx.session.user.id,
          });

          return tx.task.update({
            where: { id: task.id, projectId: input.projectId },
            data: { status: input.status, position: index },
            include: taskInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    }),

  delete: writerProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await getTaskOrThrow(ctx.prisma, input.projectId, input.taskId);
      return scopedWrite(
        "Task",
        ctx.prisma.task.delete({ where: { id: input.taskId, projectId: input.projectId } })
      );
    }),

  addToSprint: writerProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string(), sprintId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const task = await getTaskOrThrow(tx, input.projectId, input.taskId);
        await getSprintOrThrow(tx, input.projectId, input.sprintId);
        await scopedWrite("Task", setTaskSprint(tx, task, input.sprintId, ctx.session.user.id));
        return tx.task.findFirstOrThrow({
          where: { id: input.taskId, projectId: input.projectId },
          include: taskInclude,
        });
      });
    }),

  removeFromSprint: writerProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const task = await getTaskOrThrow(tx, input.projectId, input.taskId);
        await scopedWrite("Task", setTaskSprint(tx, task, null, ctx.session.user.id));
        return tx.task.findFirstOrThrow({
          where: { id: input.taskId, projectId: input.projectId },
          include: taskInclude,
        });
      });
    }),

  addComment: writerProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string(), body: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await getTaskOrThrow(ctx.prisma, input.projectId, input.taskId);
      return ctx.prisma.taskComment.create({
        data: { taskId: input.taskId, userId: ctx.session.user.id, body: input.body },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });
    }),

  comments: projectProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      await getTaskOrThrow(ctx.prisma, input.projectId, input.taskId);
      return ctx.prisma.taskComment.findMany({
        where: { taskId: input.taskId, task: { projectId: input.projectId } },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),
});
