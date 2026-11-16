import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addMember,
  callerFor,
  createProject,
  createSprint,
  createTask,
  createUser,
  resetDb,
} from "./helpers";

type World = Awaited<ReturnType<typeof buildWorld>>;

/**
 * Two isolated projects.
 *   A: adminA (owner), memberA, viewerA, sprintA, taskA, labelA
 *   B: adminB (owner), memberB, sprintB, taskB, labelB, commentB
 * `outsider` belongs to neither.
 */
async function buildWorld() {
  const adminA = await createUser("AdminA");
  const memberA = await createUser("MemberA");
  const viewerA = await createUser("ViewerA");
  const adminB = await createUser("AdminB");
  const memberB = await createUser("MemberB");
  const outsider = await createUser("Outsider");

  const { project: A, label: labelA } = await createProject(adminA, "AAA");
  await addMember(A.id, memberA.id, "MEMBER");
  await addMember(A.id, viewerA.id, "VIEWER");
  const sprintA = await createSprint(A.id);
  const taskA = await createTask(A.id, adminA.id, { title: "task A", sprintId: sprintA.id });

  const { project: B, label: labelB } = await createProject(adminB, "BBB");
  const memberRowB = await addMember(B.id, memberB.id, "MEMBER");
  const sprintB = await createSprint(B.id);
  const taskB = await createTask(B.id, adminB.id, { title: "task B", sprintId: sprintB.id });
  const commentB = await prisma.taskComment.create({
    data: { taskId: taskB.id, userId: adminB.id, body: "secret B comment" },
  });

  return {
    adminA, memberA, viewerA, adminB, memberB, outsider,
    A, labelA, sprintA, taskA,
    B, labelB, sprintB, taskB, memberRowB, commentB,
  };
}

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await buildWorld();
});

const NOT_FOUND = { code: "NOT_FOUND" };
const FORBIDDEN = { code: "FORBIDDEN" };
const BAD_REQUEST = { code: "BAD_REQUEST" };

describe("cross-project access (IDOR) — caller is a member of A, ids belong to B", () => {
  // Even an ADMIN of A, using A's projectId, must not reach B's entities.
  it("task procedures return NOT_FOUND and leave B's task untouched", async () => {
    const c = callerFor(w.adminA);
    const p = w.A.id;
    const taskId = w.taskB.id;

    await expect(c.task.update({ projectId: p, taskId, title: "pwned" })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.task.move({ projectId: p, taskId, status: "DONE", position: 0 })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.task.delete({ projectId: p, taskId })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.task.addToSprint({ projectId: p, taskId, sprintId: w.sprintA.id })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.task.removeFromSprint({ projectId: p, taskId })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.task.addComment({ projectId: p, taskId, body: "hi" })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.task.comments({ projectId: p, taskId })).rejects.toMatchObject(NOT_FOUND);

    const after = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(after.title).toBe("task B");
    expect(after.status).toBe("TODO");
    expect(after.sprintId).toBe(w.sprintB.id);
    expect(await prisma.taskComment.count({ where: { taskId } })).toBe(1);
  });

  it("addToSprint rejects a sprint from another project", async () => {
    const c = callerFor(w.adminA);
    await expect(
      c.task.addToSprint({ projectId: w.A.id, taskId: w.taskA.id, sprintId: w.sprintB.id })
    ).rejects.toMatchObject(NOT_FOUND);
  });

  it("sprint procedures return NOT_FOUND and leave B's sprint untouched", async () => {
    const c = callerFor(w.adminA);
    const p = w.A.id;
    const sprintId = w.sprintB.id;

    await expect(c.sprint.start({ projectId: p, sprintId })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.sprint.complete({ projectId: p, sprintId })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.sprint.update({ projectId: p, sprintId, name: "pwned" })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.sprint.delete({ projectId: p, sprintId })).rejects.toMatchObject(NOT_FOUND);

    const after = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
    expect(after.status).toBe("PLANNED");
    expect(after.name).not.toBe("pwned");
  });

  it("member procedures return NOT_FOUND and leave B's membership untouched", async () => {
    const c = callerFor(w.adminA);
    const p = w.A.id;
    const memberId = w.memberRowB.id;

    await expect(c.project.updateMemberRole({ projectId: p, memberId, role: "VIEWER" })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.project.removeMember({ projectId: p, memberId })).rejects.toMatchObject(NOT_FOUND);

    const after = await prisma.projectMember.findUniqueOrThrow({ where: { id: memberId } });
    expect(after.role).toBe("MEMBER");
  });

  it("report procedures return NOT_FOUND for another project's sprint", async () => {
    const c = callerFor(w.adminA);
    await expect(c.report.burndown({ projectId: w.A.id, sprintId: w.sprintB.id })).rejects.toMatchObject(NOT_FOUND);
    await expect(c.report.cumulativeFlow({ projectId: w.A.id, sprintId: w.sprintB.id })).rejects.toMatchObject(NOT_FOUND);
  });

  it("a non-member cannot use another project's id at all", async () => {
    const c = callerFor(w.adminA);
    await expect(c.task.list({ projectId: w.B.id })).rejects.toMatchObject(FORBIDDEN);
    await expect(c.task.update({ projectId: w.B.id, taskId: w.taskB.id, title: "pwned" })).rejects.toMatchObject(FORBIDDEN);
    await expect(callerFor(w.outsider).project.get({ projectId: w.A.id })).rejects.toMatchObject(FORBIDDEN);
  });

  it("legit same-project operations still work", async () => {
    const c = callerFor(w.memberA);
    const updated = await c.task.update({ projectId: w.A.id, taskId: w.taskA.id, title: "renamed" });
    expect(updated.title).toBe("renamed");
    const sprint = await c.sprint.update({ projectId: w.A.id, sprintId: w.sprintA.id, name: "S1" });
    expect(sprint.name).toBe("S1");
  });
});

describe("viewer role is read-only on the server", () => {
  it("rejects every write procedure with FORBIDDEN", async () => {
    const c = callerFor(w.viewerA);
    const p = w.A.id;
    const taskId = w.taskA.id;
    const sprintId = w.sprintA.id;
    const now = new Date("2026-03-01T00:00:00Z");
    const later = new Date("2026-03-15T00:00:00Z");

    const calls: Array<[string, () => Promise<unknown>]> = [
      ["task.create", () => c.task.create({ projectId: p, title: "x" })],
      ["task.update", () => c.task.update({ projectId: p, taskId, title: "x" })],
      ["task.move", () => c.task.move({ projectId: p, taskId, status: "DONE", position: 0 })],
      ["task.delete", () => c.task.delete({ projectId: p, taskId })],
      ["task.addToSprint", () => c.task.addToSprint({ projectId: p, taskId, sprintId })],
      ["task.removeFromSprint", () => c.task.removeFromSprint({ projectId: p, taskId })],
      ["task.addComment", () => c.task.addComment({ projectId: p, taskId, body: "x" })],
      ["sprint.create", () => c.sprint.create({ projectId: p, name: "x", startDate: now, endDate: later })],
      ["sprint.start", () => c.sprint.start({ projectId: p, sprintId })],
      ["sprint.complete", () => c.sprint.complete({ projectId: p, sprintId })],
      ["sprint.update", () => c.sprint.update({ projectId: p, sprintId, name: "x" })],
      ["sprint.delete", () => c.sprint.delete({ projectId: p, sprintId })],
      ["project.inviteMember", () => c.project.inviteMember({ projectId: p, email: w.outsider.email, role: "MEMBER" })],
      ["project.updateMemberRole", () => c.project.updateMemberRole({ projectId: p, memberId: "x", role: "ADMIN" })],
      ["project.removeMember", () => c.project.removeMember({ projectId: p, memberId: "x" })],
    ];

    for (const [name, call] of calls) {
      await expect(call(), name).rejects.toMatchObject(FORBIDDEN);
    }

    const after = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(after.title).toBe("task A");
  });

  it("can still read", async () => {
    const c = callerFor(w.viewerA);
    await expect(c.task.list({ projectId: w.A.id })).resolves.toHaveLength(1);
    await expect(c.sprint.list({ projectId: w.A.id })).resolves.toHaveLength(1);
    const project = await c.project.get({ projectId: w.A.id });
    expect(project.myRole).toBe("VIEWER");
  });

  it("MEMBER may write but not administer members", async () => {
    const c = callerFor(w.memberA);
    await expect(c.task.create({ projectId: w.A.id, title: "ok" })).resolves.toMatchObject({ title: "ok" });
    await expect(
      c.project.inviteMember({ projectId: w.A.id, email: w.outsider.email, role: "MEMBER" })
    ).rejects.toMatchObject(FORBIDDEN);
    const row = await prisma.projectMember.findFirstOrThrow({ where: { projectId: w.A.id, userId: w.viewerA.id } });
    await expect(
      c.project.updateMemberRole({ projectId: w.A.id, memberId: row.id, role: "ADMIN" })
    ).rejects.toMatchObject(FORBIDDEN);
  });
});

describe("last admin protection", () => {
  const rowOf = (projectId: string, userId: string) =>
    prisma.projectMember.findFirstOrThrow({ where: { projectId, userId } });

  it("the only admin cannot be demoted, even by themselves", async () => {
    const own = await rowOf(w.A.id, w.adminA.id);
    await expect(
      callerFor(w.adminA).project.updateMemberRole({ projectId: w.A.id, memberId: own.id, role: "MEMBER" })
    ).rejects.toMatchObject(BAD_REQUEST);
    expect((await rowOf(w.A.id, w.adminA.id)).role).toBe("ADMIN");
  });

  it("the only admin cannot leave (remove themselves)", async () => {
    const own = await rowOf(w.A.id, w.adminA.id);
    await expect(
      callerFor(w.adminA).project.removeMember({ projectId: w.A.id, memberId: own.id })
    ).rejects.toMatchObject(BAD_REQUEST);
    expect(await prisma.projectMember.count({ where: { projectId: w.A.id, role: "ADMIN" } })).toBe(1);
  });

  it("with two admins one can step down, after which the other is protected", async () => {
    await addMember(w.A.id, w.memberB.id, "ADMIN");
    const first = await rowOf(w.A.id, w.adminA.id);
    const second = await rowOf(w.A.id, w.memberB.id);

    await expect(
      callerFor(w.adminA).project.updateMemberRole({ projectId: w.A.id, memberId: first.id, role: "MEMBER" })
    ).resolves.toMatchObject({ role: "MEMBER" });

    await expect(
      callerFor(w.memberB).project.updateMemberRole({ projectId: w.A.id, memberId: second.id, role: "MEMBER" })
    ).rejects.toMatchObject(BAD_REQUEST);
    await expect(
      callerFor(w.memberB).project.removeMember({ projectId: w.A.id, memberId: second.id })
    ).rejects.toMatchObject(BAD_REQUEST);
  });

  it("two admins demoting each other at the same time never leaves zero admins", async () => {
    await addMember(w.A.id, w.memberB.id, "ADMIN");
    const first = await rowOf(w.A.id, w.adminA.id);
    const second = await rowOf(w.A.id, w.memberB.id);

    await Promise.allSettled([
      callerFor(w.adminA).project.updateMemberRole({ projectId: w.A.id, memberId: second.id, role: "MEMBER" }),
      callerFor(w.memberB).project.updateMemberRole({ projectId: w.A.id, memberId: first.id, role: "MEMBER" }),
    ]);

    expect(await prisma.projectMember.count({ where: { projectId: w.A.id, role: "ADMIN" } })).toBeGreaterThanOrEqual(1);
  });
});

describe("references must belong to the same project", () => {
  it("task.create rejects assignee / sprint / labels from another project", async () => {
    const c = callerFor(w.adminA);
    const p = w.A.id;

    await expect(c.task.create({ projectId: p, title: "x", assigneeId: w.memberB.id })).rejects.toMatchObject(BAD_REQUEST);
    await expect(c.task.create({ projectId: p, title: "x", sprintId: w.sprintB.id })).rejects.toMatchObject(BAD_REQUEST);
    await expect(c.task.create({ projectId: p, title: "x", labelIds: [w.labelB.id] })).rejects.toMatchObject(BAD_REQUEST);
    await expect(
      c.task.create({ projectId: p, title: "x", labelIds: [w.labelA.id, w.labelB.id] })
    ).rejects.toMatchObject(BAD_REQUEST);

    expect(await prisma.task.count({ where: { projectId: p, title: "x" } })).toBe(0);
  });

  it("task.update rejects assignee / sprint / labels from another project", async () => {
    const c = callerFor(w.adminA);
    const base = { projectId: w.A.id, taskId: w.taskA.id };

    await expect(c.task.update({ ...base, assigneeId: w.memberB.id })).rejects.toMatchObject(BAD_REQUEST);
    await expect(c.task.update({ ...base, sprintId: w.sprintB.id })).rejects.toMatchObject(BAD_REQUEST);
    await expect(c.task.update({ ...base, labelIds: [w.labelB.id] })).rejects.toMatchObject(BAD_REQUEST);

    const after = await prisma.task.findUniqueOrThrow({ where: { id: w.taskA.id }, include: { labels: true } });
    expect(after.assigneeId).toBeNull();
    expect(after.sprintId).toBe(w.sprintA.id);
    expect(after.labels).toHaveLength(0);
  });

  it("accepts references from the same project, and null clears them", async () => {
    const c = callerFor(w.adminA);
    const ok = await c.task.update({
      projectId: w.A.id,
      taskId: w.taskA.id,
      assigneeId: w.memberA.id,
      labelIds: [w.labelA.id],
    });
    expect(ok.assigneeId).toBe(w.memberA.id);
    expect(ok.labels.map((l) => l.id)).toEqual([w.labelA.id]);

    const cleared = await c.task.update({ projectId: w.A.id, taskId: w.taskA.id, assigneeId: null, sprintId: null });
    expect(cleared.assigneeId).toBeNull();
    expect(cleared.sprintId).toBeNull();
  });
});

describe("demo account sandbox", () => {
  it("cannot create projects, administer members, or reach projects it does not own", async () => {
    const demo = await createUser("Demo", "demo@agileboard.dev");
    const { project: demoProject } = await createProject(demo, "DEM");
    await prisma.projectMember.update({
      where: { projectId_userId: { projectId: demoProject.id, userId: demo.id } },
      data: { role: "MEMBER" },
    });
    // A real project that (wrongly) has the demo user as a member.
    await addMember(w.A.id, demo.id, "ADMIN");

    const c = callerFor(demo, { isDemo: true });

    await expect(c.project.create({ name: "x", key: "XX" })).rejects.toMatchObject(FORBIDDEN);
    await expect(c.task.list({ projectId: w.A.id })).rejects.toMatchObject(FORBIDDEN);
    await expect(c.task.list({ projectId: demoProject.id })).resolves.toEqual([]);
    await expect(
      c.project.inviteMember({ projectId: demoProject.id, email: w.outsider.email, role: "MEMBER" })
    ).rejects.toMatchObject(FORBIDDEN);

    const listed = await c.project.list();
    expect(listed.map((p) => p.id)).toEqual([demoProject.id]);
  });

  it("the demo account cannot be invited into a real project", async () => {
    await createUser("Demo", "demo@agileboard.dev");
    await expect(
      callerFor(w.adminA).project.inviteMember({ projectId: w.A.id, email: "demo@agileboard.dev", role: "MEMBER" })
    ).rejects.toMatchObject(BAD_REQUEST);
  });
});

describe("task.move ordering", () => {
  it("only reorders the destination column of the same sprint and touches only changed rows", async () => {
    const sprint2 = await createSprint(w.A.id);
    const c = callerFor(w.adminA);

    const mk = (title: string, position: number, sprintId: string | null, status: "TODO" | "BACKLOG" = "TODO") =>
      createTask(w.A.id, w.adminA.id, { title, position, sprintId, status });

    const t0 = await mk("t0", 0, w.sprintA.id);
    const t1 = await mk("t1", 1, w.sprintA.id);
    const t2 = await mk("t2", 2, w.sprintA.id);
    // Same status, other sprint / backlog: must never be touched by a move in sprintA.
    const u0 = await mk("u0", 0, sprint2.id);
    const u1 = await mk("u1", 1, sprint2.id);
    const b0 = await mk("b0", 0, null, "BACKLOG");
    await prisma.task.update({ where: { id: w.taskA.id }, data: { status: "DONE" } });

    const before = await prisma.task.findMany({ select: { id: true, position: true, updatedAt: true } });
    const snap = new Map(before.map((r) => [r.id, r]));

    await c.task.move({ projectId: w.A.id, taskId: t2.id, status: "TODO", position: 0 });

    const order = (await prisma.task.findMany({
      where: { sprintId: w.sprintA.id, status: "TODO" },
      orderBy: { position: "asc" },
    })).map((t) => t.title);
    expect(order).toEqual(["t2", "t0", "t1"]);

    for (const other of [u0, u1, b0]) {
      const row = await prisma.task.findUniqueOrThrow({ where: { id: other.id } });
      expect(row.position).toBe(snap.get(other.id)!.position);
      expect(row.updatedAt.getTime()).toBe(snap.get(other.id)!.updatedAt.getTime());
    }
  });

  it("moving to the bottom of a column only rewrites rows that shift", async () => {
    const c = callerFor(w.adminA);
    const a = await createTask(w.A.id, w.adminA.id, { title: "a", position: 0, sprintId: w.sprintA.id });
    const b = await createTask(w.A.id, w.adminA.id, { title: "b", position: 1, sprintId: w.sprintA.id });
    const d = await createTask(w.A.id, w.adminA.id, { title: "d", position: 2, sprintId: w.sprintA.id });
    await prisma.task.update({ where: { id: w.taskA.id }, data: { status: "DONE" } });

    // Move a to the end: b and d each shift up by one (a single increment statement).
    await c.task.move({ projectId: w.A.id, taskId: a.id, status: "TODO", position: 99 });

    const rows = await prisma.task.findMany({
      where: { sprintId: w.sprintA.id, status: "TODO" },
      orderBy: { position: "asc" },
    });
    expect(rows.map((r) => r.title)).toEqual(["b", "d", "a"]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(rows.find((r) => r.id === d.id)!.position).toBe(1);
  });

  it("changes the task's status when moved across columns", async () => {
    const c = callerFor(w.memberA);
    const moved = await c.task.move({ projectId: w.A.id, taskId: w.taskA.id, status: "IN_PROGRESS", position: 0 });
    expect(moved.status).toBe("IN_PROGRESS");
    expect(moved.position).toBe(0);
  });
});
