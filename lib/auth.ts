import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

// Resolve a plain username (e.g. "admin") or full email ("admin@cs.nz") to a DB user.
// Allows testers to type just the username prefix without the domain.
async function findUserByLogin(login: string) {
  const normalized = login.trim().toLowerCase();
  // Try exact email match first
  const byEmail = await prisma.user.findUnique({ where: { email: normalized } });
  if (byEmail) return byEmail;
  // Fall back: treat as username, append @cs.nz
  if (!normalized.includes("@")) {
    return prisma.user.findUnique({ where: { email: `${normalized}@cs.nz` } });
  }
  return null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await findUserByLogin(credentials.email as string);

        if (!user || !user.passwordHash) return null;

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("Account locked. Try again later.");
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) {
          const failedAttempts = user.failedAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedAttempts,
              lockedUntil:
                failedAttempts >= 5
                  ? new Date(Date.now() + 30 * 60 * 1000)
                  : undefined,
            },
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string }).role =
          token.role as string;
        (session.user as { role?: string; id?: string }).id =
          token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — generous for dev/testing
  },
});
