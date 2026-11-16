import { z } from "zod";
import type { PrismaClient, TaskStatus } from "@prisma/client";
import { router, projectProcedure } from "@/server/trpc";
import { getSprintOrThrow } from "@/server/lib/guards";

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

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, -1);
}

const ISO_DAY = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type SprintHistory = Awaited<ReturnType<typeof loadSprintHistory>>;

/**
 * Everything needed to replay a sprint from the TaskStatusChange log.
 * A task is "in the sprint" at time t when its last event for this sprint at or
 * before t has toStatus != BACKLOG (a change TO BACKLOG records leaving the sprint).
 */
async function loadSprintHistory(db: PrismaClient, projectId: string, sprintId: string) {
  const events = await db.taskStatusChange.findMany({
    where: { projectId, sprintId },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    select: { taskId: true, toStatus: true, changedAt: true, isBaseline: true },
  });
  const currentTasks = await db.task.findMany({
    where: { projectId, sprintId },
    select: { id: true, status: true, storyPoints: true },
  });

  const byTask = new Map<string, typeof events>();
  for (const e of events) byTask.set(e.taskId, [...(byTask.get(e.taskId) ?? []), e]);

  const ids = Array.from(new Set([...Array.from(byTask.keys()), ...currentTasks.map((t) => t.id)]));
  const pointRows = await db.task.findMany({
    where: { projectId, id: { in: ids } },
    select: { id: true, storyPoints: true },
  });
  const points = new Map(pointRows.map((t) => [t.id, t.storyPoints ?? 0]));

  const baselineTimes = events.filter((e) => e.isBaseline).map((e) => e.changedAt.getTime());
  const baselineAt = baselineTimes.length > 0 ? new Date(Math.min(...baselineTimes)) : null;
  const untracked = currentTasks.filter((t) => !byTask.has(t.id)).length;

  return { events, currentTasks, byTask, points, baselineAt, untracked };
}

/** Is the replayed state at `at` real data? Before the baseline snapshot it is unknown. */
function isKnown(h: SprintHistory, at: Date) {
  return h.events.length > 0 && (!h.baselineAt || at.getTime() >= h.baselineAt.getTime());
}

/** Per-status task counts and story points for tasks in the sprint at time `at`. */
function replayAt(h: SprintHistory, at: Date) {
  const counts: Record<Exclude<TaskStatus, "BACKLOG">, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };
  let totalPoints = 0;
  let remainingPoints = 0;
  h.byTask.forEach((evs, taskId) => {
    let status: TaskStatus | null = null;
    for (const e of evs) {
      if (e.changedAt.getTime() > at.getTime()) break;
      status = e.toStatus;
    }
    if (status === null || status === "BACKLOG") return; // not (yet / any more) in the sprint
    counts[status] += 1;
    const pts = h.points.get(taskId) ?? 0;
    totalPoints += pts;
    if (status !== "DONE") remainingPoints += pts;
  });
  return { counts, totalPoints, remainingPoints };
}

/** full = real history for every day; partial = real history only from some date; none = no usable history. */
function classify(h: SprintHistory, knownDays: number, sprintStart: Date) {
  if (h.events.length === 0 || knownDays === 0) return "none" as const;
  const startsLate = !!h.baselineAt && h.baselineAt.getTime() > endOfDay(sprintStart).getTime();
  return startsLate || h.untracked > 0 ? ("partial" as const) : ("full" as const);
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
   * Burndown computed from the TaskStatusChange log (not from the current state).
   * Remaining work on a day = story points of tasks in the sprint at the end of
   * that day that are not DONE, so scope added or removed mid-sprint shows up.
   * Days with no real data are returned as `actual: null` and never extrapolated.
   * `history`: "full" | "partial" (real data only from `trackedFrom`) | "none".
   */
  burndown: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await getSprintOrThrow(ctx.prisma, input.projectId, input.sprintId);
      const h = await loadSprintHistory(ctx.prisma, input.projectId, sprint.id);

      const totalPointsNow = h.currentTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
      const remainingPointsNow = h.currentTasks
        .filter((t) => t.status !== "DONE")
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

      const days = eachDay(sprint.startDate, sprint.endDate);
      const now = new Date();
      const todayKey = ISO_DAY(now);
      const cutFor = (day: Date) => new Date(Math.min(endOfDay(day).getTime(), now.getTime()));
      const isFuture = (day: Date) => day.getTime() > now.getTime();

      // The ideal line starts from the scope at the end of the first sprint day when that
      // is known, otherwise from the current scope (the history label says so).
      const startCut = cutFor(days[0]);
      const initialScope =
        !isFuture(days[0]) && isKnown(h, startCut) ? replayAt(h, startCut).totalPoints : totalPointsNow;
      const totalDays = Math.max(days.length - 1, 1);

      let knownDays = 0;
      const series = days.map((day, idx) => {
        const ideal = Math.max(initialScope - (initialScope / totalDays) * idx, 0);
        let actual: number | null = null;
        if (!isFuture(day) && isKnown(h, cutFor(day))) {
          actual = replayAt(h, cutFor(day)).remainingPoints;
          knownDays += 1;
        }
        return { date: ISO_DAY(day), ideal: Math.round(ideal * 10) / 10, actual };
      });

      const history = classify(h, knownDays, sprint.startDate);

      // With no usable history the only honest actual value is the real state today.
      if (history === "none") {
        const today = series.find((p) => p.date === todayKey);
        if (today) today.actual = remainingPointsNow;
      }

      return {
        totalPoints: totalPointsNow,
        remainingPoints: remainingPointsNow,
        series,
        history,
        trackedFrom: h.baselineAt ? h.baselineAt.toISOString() : null,
        untrackedTasks: h.untracked,
      };
    }),

  /**
   * Cumulative flow computed from the TaskStatusChange log: one point per day with
   * the number of sprint tasks in each status at the end of that day. Only days with
   * real data are returned (nothing is projected backwards). BACKLOG is not a
   * sprint status, so it is not part of the series.
   */
  cumulativeFlow: projectProcedure
    .input(z.object({ projectId: z.string(), sprintId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sprint = await getSprintOrThrow(ctx.prisma, input.projectId, input.sprintId);
      const h = await loadSprintHistory(ctx.prisma, input.projectId, sprint.id);

      const statuses = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
      const counts = Object.fromEntries(
        statuses.map((st) => [st, h.currentTasks.filter((t) => t.status === st).length])
      ) as Record<(typeof statuses)[number], number>;

      const now = new Date();
      const lastDay = now < sprint.endDate ? now : sprint.endDate;
      const days = eachDay(sprint.startDate, lastDay).filter((d) => d.getTime() <= now.getTime());

      const series: { date: string; TODO: number; IN_PROGRESS: number; IN_REVIEW: number; DONE: number }[] = [];
      for (const day of days) {
        const cut = new Date(Math.min(endOfDay(day).getTime(), now.getTime()));
        if (!isKnown(h, cut)) continue;
        series.push({ date: ISO_DAY(day), ...replayAt(h, cut).counts });
      }

      return {
        counts,
        series,
        history: classify(h, series.length, sprint.startDate),
        trackedFrom: h.baselineAt ? h.baselineAt.toISOString() : null,
        untrackedTasks: h.untracked,
      };
    }),
});
