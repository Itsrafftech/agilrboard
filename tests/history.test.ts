import { beforeEach, describe, expect, it } from "vitest";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addMember, callerFor, createProject, createTask, createUser, resetDb } from "./helpers";

let admin: Awaited<ReturnType<typeof createUser>>;
let project: Awaited<ReturnType<typeof createProject>>["project"];

beforeEach(async () => {
  await resetDb();
  admin = await createUser("Admin");
  ({ project } = await createProject(admin, "HST"));
});

/** Local-time helper so the tests do not depend on the machine's timezone. */
const at = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour, 0, 0);

async function makeSprint(start = at(1, 5, 0), end = at(1, 19, 0)) {
  return prisma.sprint.create({
    data: { projectId: project.id, name: "S", startDate: start, endDate: end, status: "COMPLETED" },
  });
}

async function makeTask(sprintId: string | null, status: TaskStatus, storyPoints: number) {
  const t = await createTask(project.id, admin.id, { sprintId, status });
  return prisma.task.update({ where: { id: t.id }, data: { storyPoints } });
}

function ev(
  taskId: string,
  sprintId: string | null,
  from: TaskStatus | null,
  to: TaskStatus,
  changedAt: Date,
  isBaseline = false
) {
  return { taskId, projectId: project.id, sprintId, fromStatus: from, toStatus: to, changedById: admin.id, changedAt, isBaseline };
}

describe("status changes are recorded by the routers", () => {
  const rows = (taskId: string) =>
    prisma.taskStatusChange.findMany({ where: { taskId }, orderBy: [{ changedAt: "asc" }, { id: "asc" }] });

  it("create, move, addToSprint, removeFromSprint and update(sprintId) each write history", async () => {
    const c = callerFor(admin);
    const sprint = await makeSprint();

    const task = await c.task.create({ projectId: project.id, title: "t", status: "BACKLOG" });
    let r = await rows(task.id);
    expect(r.map((x) => [x.fromStatus, x.toStatus, x.sprintId])).toEqual([[null, "BACKLOG", null]]);

    await c.task.addToSprint({ projectId: project.id, taskId: task.id, sprintId: sprint.id });
    await c.task.move({ projectId: project.id, taskId: task.id, status: "IN_PROGRESS", position: 0 });
    r = await rows(task.id);
    expect(r.map((x) => [x.fromStatus, x.toStatus, x.sprintId])).toEqual([
      [null, "BACKLOG", null],
      ["BACKLOG", "TODO", sprint.id],
      ["TODO", "IN_PROGRESS", sprint.id],
    ]);

    await c.task.removeFromSprint({ projectId: project.id, taskId: task.id });
    r = await rows(task.id);
    expect(r[r.length - 1]).toMatchObject({ fromStatus: "IN_PROGRESS", toStatus: "BACKLOG", sprintId: sprint.id });

    // update() changing sprintId follows the same rules
    await c.task.update({ projectId: project.id, taskId: task.id, sprintId: sprint.id });
    const after = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after).toMatchObject({ sprintId: sprint.id, status: "TODO" });
    r = await rows(task.id);
    expect(r[r.length - 1]).toMatchObject({ toStatus: "TODO", sprintId: sprint.id });
  });

  it("reordering inside a column writes no history", async () => {
    const c = callerFor(admin);
    const sprint = await makeSprint();
    const a = await createTask(project.id, admin.id, { sprintId: sprint.id, status: "TODO", position: 0 });
    await createTask(project.id, admin.id, { sprintId: sprint.id, status: "TODO", position: 1 });

    await c.task.move({ projectId: project.id, taskId: a.id, status: "TODO", position: 1 });
    expect(await rows(a.id)).toHaveLength(0);
  });

  it("history is written in the same transaction as the change (nothing is left behind on failure)", async () => {
    const c = callerFor(admin);
    const outsider = await createUser("Outsider");
    await expect(
      c.task.create({ projectId: project.id, title: "x", assigneeId: outsider.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prisma.taskStatusChange.count()).toBe(0);
  });

  it("rejects contradictory sprint/status combinations", async () => {
    const c = callerFor(admin);
    const sprint = await makeSprint();
    await expect(
      c.task.create({ projectId: project.id, title: "x", sprintId: sprint.id, status: "BACKLOG" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const t = await createTask(project.id, admin.id, { sprintId: sprint.id, status: "TODO" });
    await expect(
      c.task.move({ projectId: project.id, taskId: t.id, status: "BACKLOG", position: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("viewers still cannot create history", async () => {
    const viewer = await createUser("Viewer");
    await addMember(project.id, viewer.id, "VIEWER");
    await expect(callerFor(viewer).task.create({ projectId: project.id, title: "x" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await prisma.taskStatusChange.count()).toBe(0);
  });
});

describe("burndown and cumulative flow are derived from the history log", () => {
  it("replays real transitions, including scope added and removed mid-sprint", async () => {
    const sprint = await makeSprint();
    const A = await makeTask(sprint.id, "DONE", 5);
    const B = await makeTask(sprint.id, "DONE", 3);
    const C = await makeTask(null, "BACKLOG", 2); // joined on 01-08, left on 01-10

    await prisma.taskStatusChange.createMany({
      data: [
        ev(A.id, sprint.id, null, "TODO", at(1, 5, 9)),
        ev(A.id, sprint.id, "TODO", "IN_PROGRESS", at(1, 7, 10)),
        ev(A.id, sprint.id, "IN_PROGRESS", "DONE", at(1, 9, 10)),
        ev(B.id, sprint.id, null, "TODO", at(1, 5, 10)),
        ev(B.id, sprint.id, "TODO", "DONE", at(1, 12, 10)),
        ev(C.id, sprint.id, "BACKLOG", "TODO", at(1, 8, 10)),
        ev(C.id, sprint.id, "TODO", "BACKLOG", at(1, 10, 10)),
      ],
    });

    const c = callerFor(admin);
    const burn = await c.report.burndown({ projectId: project.id, sprintId: sprint.id });
    const actual = Object.fromEntries(burn.series.map((p) => [p.date, p.actual]));

    expect(burn.history).toBe("full");
    expect(burn.trackedFrom).toBeNull();
    expect(actual).toMatchObject({
      "2026-01-05": 8,
      "2026-01-06": 8,
      "2026-01-07": 8, // A is in progress, still open
      "2026-01-08": 10, // C (2 pts) added mid-sprint
      "2026-01-09": 5, // A done
      "2026-01-10": 3, // C left the sprint
      "2026-01-11": 3,
      "2026-01-12": 0, // B done
      "2026-01-19": 0,
    });
    // ideal pace starts from the scope at the end of day 1 and ends at 0
    expect(burn.series[0].ideal).toBe(8);
    expect(burn.series[burn.series.length - 1].ideal).toBe(0);

    const cfd = await c.report.cumulativeFlow({ projectId: project.id, sprintId: sprint.id });
    const byDate = Object.fromEntries(cfd.series.map((p) => [p.date, p]));
    expect(cfd.history).toBe("full");
    expect(byDate["2026-01-05"]).toMatchObject({ TODO: 2, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 });
    expect(byDate["2026-01-07"]).toMatchObject({ TODO: 1, IN_PROGRESS: 1, DONE: 0 });
    expect(byDate["2026-01-09"]).toMatchObject({ TODO: 2, IN_PROGRESS: 0, DONE: 1 }); // B + C waiting, A done
    expect(byDate["2026-01-10"]).toMatchObject({ TODO: 1, DONE: 1 });
    expect(byDate["2026-01-12"]).toMatchObject({ TODO: 0, DONE: 2 });
  });

  it("does not invent data before the baseline snapshot (legacy sprint, partial history)", async () => {
    const sprint = await makeSprint();
    const X = await makeTask(sprint.id, "IN_PROGRESS", 4);
    await prisma.taskStatusChange.create({
      data: ev(X.id, sprint.id, null, "IN_PROGRESS", at(1, 12, 15), true),
    });

    const c = callerFor(admin);
    const burn = await c.report.burndown({ projectId: project.id, sprintId: sprint.id });
    const actual = Object.fromEntries(burn.series.map((p) => [p.date, p.actual]));

    expect(burn.history).toBe("partial");
    expect(burn.trackedFrom).toBe(at(1, 12, 15).toISOString());
    expect(actual["2026-01-05"]).toBeNull();
    expect(actual["2026-01-11"]).toBeNull();
    expect(actual["2026-01-12"]).toBe(4);
    expect(actual["2026-01-19"]).toBe(4);

    const cfd = await c.report.cumulativeFlow({ projectId: project.id, sprintId: sprint.id });
    expect(cfd.history).toBe("partial");
    expect(cfd.series[0].date).toBe("2026-01-12");
    expect(cfd.series.every((p) => p.date >= "2026-01-12")).toBe(true);
  });

  it("reports 'none' (and fabricates no past values) when a sprint has no history at all", async () => {
    const sprint = await makeSprint();
    await makeTask(sprint.id, "DONE", 3);
    await makeTask(sprint.id, "TODO", 2);

    const c = callerFor(admin);
    const burn = await c.report.burndown({ projectId: project.id, sprintId: sprint.id });
    expect(burn.history).toBe("none");
    expect(burn.series.every((p) => p.actual === null)).toBe(true); // sprint is entirely in the past
    expect(burn.totalPoints).toBe(5);
    expect(burn.remainingPoints).toBe(2);
    expect(burn.untrackedTasks).toBe(2);

    const cfd = await c.report.cumulativeFlow({ projectId: project.id, sprintId: sprint.id });
    expect(cfd.history).toBe("none");
    expect(cfd.series).toEqual([]);
  });

  it("flags tasks that have no recorded history instead of guessing for them", async () => {
    const sprint = await makeSprint();
    const tracked = await makeTask(sprint.id, "TODO", 3);
    await makeTask(sprint.id, "TODO", 5); // inserted without history
    await prisma.taskStatusChange.create({ data: ev(tracked.id, sprint.id, null, "TODO", at(1, 5, 9)) });

    const burn = await callerFor(admin).report.burndown({ projectId: project.id, sprintId: sprint.id });
    expect(burn.history).toBe("partial");
    expect(burn.untrackedTasks).toBe(1);
    expect(burn.series[0].actual).toBe(3); // only the tracked task is replayed
  });
});
