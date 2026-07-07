import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure } from "@/server/trpc";

export const sprintRouter = router({
  list: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId },
        include: { _count: { select: { tasks: true } } },
        orderBy: { startDate: "desc" },
      });
    }),

  active: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.sprint.findFirst({
        where: { projectId: input.projectId, status: "ACTIVE" },
        include: {
          tasks: {
            include: {
              assignee: { select: { id: true, name: true, email: true, image: true } },
              labels: true,
            },
            orderBy: { position: "asc" },
          },
        },
      });
    }),

  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(100),
        goal: z.string().max(1000).optional(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.endDate <= input.startDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End date must be after start date" });
      }
      return ctx.prisma.sprint.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          goal: input.goal,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      });
    }),

  start: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existingActive = await ctx.prisma.sprint.findFirst({
        where: { projectId: input.projectId, status: "ACTIVE" },
      });
      if (existingActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Another sprint is already active. Complete it first.",
        });
      }
      return ctx.prisma.sprint.update({
        where: { id: input.sprintId },
        data: { status: "ACTIVE" },
      });
    }),

  complete: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.sprint.update({
        where: { id: input.sprintId },
        data: { status: "COMPLETED" },
      });
    }),

  update: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        sprintId: z.string(),
        name: z.string().min(1).max(100).optional(),
        goal: z.string().max(1000).nullable().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, sprintId, ...data } = input;
      return ctx.prisma.sprint.update({ where: { id: sprintId }, data });
    }),

  delete: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.sprint.delete({ where: { id: input.sprintId } });
    }),

  velocity: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprints = await ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId, status: "COMPLETED" },
        include: { tasks: true },
        orderBy: { startDate: "asc" },
        take: 10,
      });

      return sprints.map((s) => ({
        sprintId: s.id,
        name: s.name,
        committed: s.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
        completed: s.tasks
          .filter((t) => t.status === "DONE")
          .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
      }));
    }),
});
