import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEMO_EMAIL, isDemoEmail, isDemoModeEnabled } from "@/lib/demo";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      // The demo account never authenticates with a password.
      if (isDemoEmail(credentials.email)) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });
      if (!user || !user.password) return null;

      const valid = await bcrypt.compare(credentials.password, user.password);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

if (isDemoModeEnabled()) {
  providers.push(
    CredentialsProvider({
      id: "demo",
      name: "Demo",
      credentials: {},
      async authorize() {
        const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
        // Fail closed if the demo account ever got a real password.
        if (!user || user.password) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    })
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isDemo = isDemoEmail(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isDemo = token.isDemo === true;
      }
      return session;
    },
  },
};
