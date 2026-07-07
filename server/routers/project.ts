import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, projectProcedure } from "@/server/trpc";

const roleSchema = z.enum(["ADMIN", "MEMBER", "VIEWER"]);

function requireAdmin(role: string) {
  if (role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only project admins can perform this action" });
  }
}

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.projectMember.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        project: {
          include: {
            _count: { select: { tasks: true, projectMembers: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return memberships.map((m) => ({
      ...m.project,
      role: m.role,
    }));
  }),

  get: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          projectMembers: {
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          },
          labels: true,
        },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...project, myRole: ctx.membership.role };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional(),
        key: z
          .string()
          .min(2)
          .max(6)
          .regex(/^[A-Za-z]+$/, "Key must be letters only")
          .transform((v) => v.toUpperCase()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          key: input.key,
          ownerId: ctx.session.user.id,
          projectMembers: {
            create: [{ userId: ctx.session.user.id, role: "ADMIN" }],
          },
          labels: {
            create: [
              { name: "Bug", color: "#ef4444" },
              { name: "Feature", color: "#6366f1" },
              { name: "Design", color: "#ec4899" },
            ],
          },
        },
      });
    }),

  inviteMember: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        email: z.string().email(),
        role: roleSchema.default("MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.membership.role);

      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that email. Ask them to register first.",
        });
      }

      const existing = await ctx.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: input.projectId, userId: user.id } },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User is already a member" });
      }

      return ctx.prisma.projectMember.create({
        data: { projectId: input.projectId, userId: user.id, role: input.role },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });
    }),

  updateMemberRole: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        memberId: z.string(),
        role: roleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.membership.role);
      return ctx.prisma.projectMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      });
    }),

  removeMember: projectProcedure
    .input(z.object({ projectId: z.string(), memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.membership.role);
      return ctx.prisma.projectMember.delete({ where: { id: input.memberId } });
    }),
});
