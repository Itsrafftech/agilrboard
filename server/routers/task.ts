import { z } from "zod";
import { router, projectProcedure } from "@/server/trpc";

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

  create: projectProcedure
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
      const maxPos = await ctx.prisma.task.aggregate({
        where: { projectId: input.projectId, status: input.status },
        _max: { position: true },
      });

      return ctx.prisma.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate,
          storyPoints: input.storyPoints,
          sprintId: input.sprintId ?? null,
          creatorId: ctx.session.user.id,
          position: (maxPos._max.position ?? -1) + 1,
          labels: input.labelIds ? { connect: input.labelIds.map((id) => ({ id })) } : undefined,
        },
        include: taskInclude,
      });
    }),

  update: projectProcedure
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
      const { projectId, taskId, labelIds, ...data } = input;
      return ctx.prisma.task.update({
        where: { id: taskId },
        data: {
          ...data,
          labels: labelIds ? { set: labelIds.map((id) => ({ id })) } : undefined,
        },
        include: taskInclude,
      });
    }),

  move: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        taskId: z.string(),
        status: statusSchema,
        position: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({ where: { id: input.taskId } });
      if (!task) return null;

      const siblings = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, status: input.status, id: { not: input.taskId } },
        orderBy: { position: "asc" },
      });

      siblings.splice(input.position, 0, { ...task, status: input.status });

      await ctx.prisma.$transaction(
        siblings.map((s, idx) =>
          ctx.prisma.task.update({
            where: { id: s.id },
            data: { position: idx, status: input.status },
          })
        )
      );

      return ctx.prisma.task.findUnique({ where: { id: input.taskId }, include: taskInclude });
    }),

  delete: projectProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.delete({ where: { id: input.taskId } });
    }),

  addToSprint: projectProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string(), sprintId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { sprintId: input.sprintId, status: "TODO" },
        include: taskInclude,
      });
    }),

  removeFromSprint: projectProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { sprintId: null, status: "BACKLOG" },
        include: taskInclude,
      });
    }),

  addComment: projectProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string(), body: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.taskComment.create({
        data: { taskId: input.taskId, userId: ctx.session.user.id, body: input.body },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });
    }),

  comments: projectProcedure
    .input(z.object({ projectId: z.string(), taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.taskComment.findMany({
        where: { taskId: input.taskId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),
});
