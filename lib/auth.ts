import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { requiresPasswordUpdate } from "@/lib/auth/password-policy";
import {
  recordSecurityEvent,
  SECURITY_EVENT_ACTION,
} from "@/lib/security/events";

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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await findUserByLogin(credentials.email as string);
        if (!user || !user.passwordHash) {
          await recordSecurityEvent({
            action: SECURITY_EVENT_ACTION.LOGIN_FAILED_UNKNOWN_USER,
            request,
            details: {
              login: String(credentials.email ?? "").trim().toLowerCase(),
            },
          });
          return null;
        }

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordSecurityEvent({
            action: SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED,
            userId: user.id,
            request,
            details: {
              lockedUntil: user.lockedUntil.toISOString(),
            },
          });
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

          await recordSecurityEvent({
            action: SECURITY_EVENT_ACTION.LOGIN_FAILED_PASSWORD,
            userId: user.id,
            request,
            details: {
              failedAttempts,
            },
          });

          if (failedAttempts >= 5) {
            await recordSecurityEvent({
              action: SECURITY_EVENT_ACTION.LOGIN_LOCKED,
              userId: user.id,
              request,
              details: {
                failedAttempts,
              },
            });
          }
          return null;
        }

        const authenticatedAt = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: authenticatedAt,
          },
        });

        await recordSecurityEvent({
          action: SECURITY_EVENT_ACTION.LOGIN_SUCCESS,
          userId: user.id,
          request,
          details: {
            role: user.role,
            method: "password_only_demo",
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          requiresPasswordChange: requiresPasswordUpdate(user),
          passwordExpiresAt: user.passwordExpiresAt?.toISOString() ?? null,
          twoFAEnabled: false,
          authenticatedAt: authenticatedAt.toISOString(),
          requiresTwoFactorSetup: false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.requiresPasswordChange = (
          user as { requiresPasswordChange?: boolean }
        ).requiresPasswordChange;
        token.passwordExpiresAt = (
          user as { passwordExpiresAt?: string | null }
        ).passwordExpiresAt;
        token.twoFAEnabled = false;
        token.authenticatedAt = (
          user as { authenticatedAt?: string | null }
        ).authenticatedAt;
        token.requiresTwoFactorSetup = false;
      }

      if (token.id) {
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            passwordChangeRequired: true,
            passwordExpiresAt: true,
          },
        });

        if (currentUser) {
          token.role = currentUser.role;
          token.requiresPasswordChange = requiresPasswordUpdate(currentUser);
          token.passwordExpiresAt =
            currentUser.passwordExpiresAt?.toISOString() ?? null;
          token.twoFAEnabled = false;
          token.authenticatedAt =
            (token.authenticatedAt as string | null | undefined) ?? null;
          token.requiresTwoFactorSetup = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (
          session.user as {
            role?: string;
            id?: string;
            requiresPasswordChange?: boolean;
            passwordExpiresAt?: string | null;
            twoFAEnabled?: boolean;
            authenticatedAt?: string | null;
            requiresTwoFactorSetup?: boolean;
          }
        ).role =
          token.role as string;
        (
          session.user as {
            role?: string;
            id?: string;
            requiresPasswordChange?: boolean;
            passwordExpiresAt?: string | null;
            twoFAEnabled?: boolean;
            authenticatedAt?: string | null;
            requiresTwoFactorSetup?: boolean;
          }
        ).id =
          token.id as string;
        (
          session.user as {
            role?: string;
            id?: string;
            requiresPasswordChange?: boolean;
            passwordExpiresAt?: string | null;
            twoFAEnabled?: boolean;
            authenticatedAt?: string | null;
            requiresTwoFactorSetup?: boolean;
          }
        ).requiresPasswordChange = Boolean(token.requiresPasswordChange);
        (
          session.user as {
            role?: string;
            id?: string;
            requiresPasswordChange?: boolean;
            passwordExpiresAt?: string | null;
            twoFAEnabled?: boolean;
            authenticatedAt?: string | null;
            requiresTwoFactorSetup?: boolean;
          }
        ).passwordExpiresAt =
          (token.passwordExpiresAt as string | null | undefined) ?? null;
        (
          session.user as {
            role?: string;
            id?: string;
            requiresPasswordChange?: boolean;
            passwordExpiresAt?: string | null;
            twoFAEnabled?: boolean;
            authenticatedAt?: string | null;
            requiresTwoFactorSetup?: boolean;
          }
        ).twoFAEnabled = Boolean(token.twoFAEnabled);
        (
          session.user as {
            role?: string;
            id?: string;
            requiresPasswordChange?: boolean;
            passwordExpiresAt?: string | null;
            twoFAEnabled?: boolean;
            authenticatedAt?: string | null;
            requiresTwoFactorSetup?: boolean;
          }
        ).authenticatedAt =
          (token.authenticatedAt as string | null | undefined) ?? null;
        (
          session.user as {
            role?: string;
            id?: string;
            requiresPasswordChange?: boolean;
            passwordExpiresAt?: string | null;
            twoFAEnabled?: boolean;
            authenticatedAt?: string | null;
            requiresTwoFactorSetup?: boolean;
          }
        ).requiresTwoFactorSetup = Boolean(token.requiresTwoFactorSetup);
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
