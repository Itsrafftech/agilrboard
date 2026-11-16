import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEMO_EMAIL, isDemoEmail, isDemoModeEnabled } from "@/lib/demo";
import {
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_WINDOW_MS,
  clientIp,
  consume,
  isBlocked,
  resetLimit,
} from "@/lib/rate-limit";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      if (!credentials?.email || !credentials?.password) return null;
      // The demo account never authenticates with a password.
      if (isDemoEmail(credentials.email)) return null;

      // Throttle brute force: every attempt counts against the IP, failed attempts
      // count against the email. Throwing surfaces as `error=RateLimited` on the client.
      const ip = clientIp(req?.headers);
      const emailKey = `login:email:${credentials.email.trim().toLowerCase()}`;
      if (ip && !consume(`login:ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS).allowed) {
        throw new Error("RateLimited");
      }
      if (isBlocked(emailKey, LOGIN_EMAIL_LIMIT)) {
        throw new Error("RateLimited");
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });
      const valid = !!user?.password && (await bcrypt.compare(credentials.password, user.password));
      if (!user || !valid) {
        consume(emailKey, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_MS);
        return null;
      }
      resetLimit(emailKey);

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
