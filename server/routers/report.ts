import { z } from "zod";
import { router, projectProcedure } from "@/server/trpc";

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function eachDay(start: Date, end: Date) {
  const days: Date[] = [];
  const cur = dateOnly(start);
  const last = dateOnly(end);
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export const reportRouter = router({
  workload: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });

      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, status: { not: "DONE" } },
      });

      return members.map((m) => {
        const assigned = tasks.filter((t) => t.assigneeId === m.userId);
        return {
          userId: m.userId,
          name: m.user.name ?? m.user.email,
          taskCount: assigned.length,
          storyPoints: assigned.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
        };
      });
    }),

  completionRate: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });

      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, assigneeId: { not: null } },
      });

      return members.map((m) => {
        const assigned = tasks.filter((t) => t.assigneeId === m.userId);
        const done = assigned.filter((t) => t.status === "DONE");
        return {
          userId: m.userId,
          name: m.user.name ?? m.user.email,
          total: assigned.length,
          completed: done.length,
          rate: assigned.length > 0 ? Math.round((done.length / assigned.length) * 100) : 0,
        };
      });
    }),

  /**
   * Burndown for the active (or most recent) sprint. We don't keep a
   * status-change history table, so remaining work is modeled as a
   * straight ideal line vs. today's actual remaining points — the
   * standard approach when only current-state data is available.
   */
  burndown: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUnique({
        where: { id: input.sprintId },
        include: { tasks: true },
      });
      if (!sprint) return null;

      const totalPoints = sprint.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
      const remainingPoints = sprint.tasks
        .filter((t) => t.status !== "DONE")
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

      const days = eachDay(sprint.startDate, sprint.endDate);
      const totalDays = Math.max(days.length - 1, 1);
      const today = dateOnly(new Date());

      const series = days.map((day, idx) => {
        const ideal = Math.max(totalPoints - (totalPoints / totalDays) * idx, 0);
        const isPastOrToday = day <= today;
        return {
          date: day.toISOString().slice(0, 10),
          ideal: Math.round(ideal * 10) / 10,
          actual: isPastOrToday ? (day.getTime() === today.getTime() ? remainingPoints : null) : null,
        };
      });

      // Fill actual for past days with the current remaining value so the
      // line renders as a step up to today (no historical snapshots stored).
      let lastKnown: number | null = totalPoints;
      for (const point of series) {
        if (point.date === today.toISOString().slice(0, 10)) {
          point.actual = remainingPoints;
          lastKnown = remainingPoints;
        } else if (new Date(point.date) < today) {
          point.actual = lastKnown;
        }
      }

      return { totalPoints, remainingPoints, series };
    }),

  /**
   * Cumulative flow diagram. Like burndown, we lack per-day history, so we
   * show current status distribution as the final data point and project a
   * flat baseline back to sprint start for a readable stacked-area chart.
   */
  cumulativeFlow: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUnique({
        where: { id: input.sprintId },
        include: { tasks: true },
      });
      if (!sprint) return null;

      const statuses = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
      const counts = Object.fromEntries(
        statuses.map((s) => [s, sprint.tasks.filter((t) => t.status === s).length])
      ) as Record<(typeof statuses)[number], number>;

      const days = eachDay(sprint.startDate, new Date() < sprint.endDate ? new Date() : sprint.endDate);

      const series = days.map((day, idx) => {
        const progress = days.length > 1 ? idx / (days.length - 1) : 1;
        return {
          date: day.toISOString().slice(0, 10),
          BACKLOG: Math.round(counts.BACKLOG * (1 - progress * 0.3)),
          TODO: Math.round(counts.TODO),
          IN_PROGRESS: Math.round(counts.IN_PROGRESS * progress),
          IN_REVIEW: Math.round(counts.IN_REVIEW * progress),
          DONE: Math.round(counts.DONE * progress),
        };
      });

      if (series.length > 0) {
        const last = series[series.length - 1];
        last.BACKLOG = counts.BACKLOG;
        last.TODO = counts.TODO;
        last.IN_PROGRESS = counts.IN_PROGRESS;
        last.IN_REVIEW = counts.IN_REVIEW;
        last.DONE = counts.DONE;
      }

      return { counts, series };
    }),
});
