import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";

export const userRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(100),
        email: z.string().email("Enter a valid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      }

      const hashed = await bcrypt.hash(input.password, 10);
      const user = await ctx.prisma.user.create({
        data: { name: input.name, email: input.email, password: hashed },
      });

      return { id: user.id, email: user.email, name: user.name };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, name: true, email: true, image: true },
    });
  }),
});
