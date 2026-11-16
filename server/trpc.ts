import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getServerSession } from "next-auth";
import superjson from "superjson";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createContext(_opts: FetchCreateContextFnOptions) {
  const session = await getServerSession(authOptions);
  return { session, prisma };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Ensures the caller is a member of `input.projectId` and attaches their
 * membership (with role) to ctx, so downstream procedures can authorize
 * write actions without re-querying.
 */
const isProjectMember = middleware(async ({ ctx, rawInput, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const input = rawInput as { projectId?: string };
  if (!input?.projectId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "projectId is required" });
  }

  const membership = await ctx.prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: input.projectId,
        userId: ctx.session.user.id,
      },
    },
  });

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this project" });
  }

  return next({
    ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user }, membership },
  });
});

export const projectProcedure = t.procedure.use(isProjectMember);

/** Any mutation that changes project content: Viewers are read-only. */
export const writerProcedure = projectProcedure.use(({ ctx, next }) => {
  if (ctx.membership.role === "VIEWER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Viewers have read-only access to this project" });
  }
  return next();
});

/** Member management and other project-level administration. */
export const adminProcedure = projectProcedure.use(({ ctx, next }) => {
  if (ctx.membership.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only project admins can perform this action" });
  }
  return next();
});
