import type { ProjectRole, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appRouter } from "@/server/routers/_app";

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "User", "Project", "VerificationToken" RESTART IDENTITY CASCADE'
  );
}

export async function createUser(name = "User", email?: string) {
  return prisma.user.create({
    data: { name, email: email ?? `${name.toLowerCase()}-${uid()}@test.dev` },
  });
}

export async function createProject(owner: { id: string }, key = "TST") {
  const project = await prisma.project.create({
    data: {
      name: `Project ${key}`,
      key,
      ownerId: owner.id,
      projectMembers: { create: [{ userId: owner.id, role: "ADMIN" }] },
    },
  });
  const label = await prisma.label.create({ data: { projectId: project.id, name: `L-${uid()}` } });
  return { project, label };
}

export async function addMember(projectId: string, userId: string, role: ProjectRole) {
  return prisma.projectMember.create({ data: { projectId, userId, role } });
}

export async function createSprint(projectId: string, status: "PLANNED" | "ACTIVE" | "COMPLETED" = "PLANNED") {
  const start = new Date("2026-01-05T00:00:00Z");
  const end = new Date("2026-01-19T00:00:00Z");
  return prisma.sprint.create({
    data: { projectId, name: `Sprint ${uid()}`, startDate: start, endDate: end, status },
  });
}

export async function createTask(
  projectId: string,
  creatorId: string,
  opts: { title?: string; status?: TaskStatus; sprintId?: string | null; position?: number } = {}
) {
  return prisma.task.create({
    data: {
      projectId,
      creatorId,
      title: opts.title ?? `Task ${uid()}`,
      status: opts.status ?? "TODO",
      sprintId: opts.sprintId ?? null,
      position: opts.position ?? 0,
    },
  });
}

export function callerFor(
  user: { id: string; email: string; name?: string | null },
  opts: { isDemo?: boolean } = {}
) {
  return appRouter.createCaller({
    session: {
      user: { id: user.id, email: user.email, name: user.name ?? null, isDemo: opts.isDemo },
      expires: new Date(Date.now() + 3_600_000).toISOString(),
    },
    prisma,
    ip: null,
  });
}
