import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { requiresPasswordUpdate } from "@/lib/auth/password-policy";
import { evaluatePilotSession } from "@/lib/auth/session-policy";
import { requiresTwoFactorSetup } from "@/lib/auth/two-factor-policy";
import { verifyTwoFactorCode } from "@/lib/auth/two-factor";
import { isDemoAccountEmail } from "@/lib/config/demo-mode";
import {
  assertRuntimeBoundaryReady,
  evaluateRuntimeBoundary,
} from "@/lib/config/runtime-boundary";
import { ensureDatabaseReady } from "@/lib/database/bootstrap";
import { prisma } from "@/lib/prisma";
import {
  recordSecurityEvent,
  SECURITY_EVENT_ACTION,
} from "@/lib/security/events";

type AuthenticatedUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  gpPracticeId: string | null;
  requiresPasswordChange: boolean;
  passwordExpiresAt: string | null;
  twoFAEnabled: boolean;
  authenticatedAt: string;
  lastActivityAt: string;
  requiresTwoFactorSetup: boolean;
  sessionVersion: number;
  authAssurance: "PASSWORD" | "PASSWORD_ENROLLMENT" | "MFA";
};

async function findUserByLogin(login: string) {
  await ensureDatabaseReady();
  const normalized = login.trim().toLowerCase();
  const byEmail = await prisma.user.findUnique({ where: { email: normalized } });
  if (byEmail) return byEmail;
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
        code: { label: "Authenticator code", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const boundary = assertRuntimeBoundaryReady("Sign-in");
        const user = await findUserByLogin(credentials.email as string);
        if (!user || !user.passwordHash) {
          await recordSecurityEvent({
            action: SECURITY_EVENT_ACTION.LOGIN_FAILED_UNKNOWN_USER,
            request,
            details: { login: String(credentials.email ?? "") },
          });
          return null;
        }

        if (
          boundary.mode === "PILOT" &&
          (user.isDemoAccount || isDemoAccountEmail(user.email))
        ) {
          await recordSecurityEvent({
            action: SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED,
            userId: user.id,
            request,
            details: { reason: "demo_identity_prohibited_in_pilot" },
          });
          return null;
        }

        if (!user.isActive) {
          await recordSecurityEvent({
            action: SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED,
            userId: user.id,
            request,
            details: { reason: "account_disabled" },
          });
          throw new Error("Account is disabled. Contact an administrator.");
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordSecurityEvent({
            action: SECURITY_EVENT_ACTION.LOGIN_BLOCKED_LOCKED,
            userId: user.id,
            request,
            details: { reason: "account_locked" },
          });
          throw new Error("Account locked. Try again later.");
        }

        const validPassword = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!validPassword) {
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
            details: { failedAttempts },
          });
          if (failedAttempts >= 5) {
            await recordSecurityEvent({
              action: SECURITY_EVENT_ACTION.LOGIN_LOCKED,
              userId: user.id,
              request,
              details: { failedAttempts },
            });
          }
          return null;
        }

        let authAssurance: AuthenticatedUser["authAssurance"] = "PASSWORD";
        if (user.twoFAEnabled) {
          const code = String(credentials.code ?? "").trim();
          if (!user.twoFASecret || !code || !verifyTwoFactorCode(user.twoFASecret, code)) {
            await recordSecurityEvent({
              action: SECURITY_EVENT_ACTION.LOGIN_FAILED_2FA,
              userId: user.id,
              request,
              details: { reason: code ? "invalid_code" : "missing_code" },
            });
            return null;
          }
          authAssurance = "MFA";
        } else if (boundary.mode === "PILOT") {
          // Password-only access exists solely to enrol an authenticator. Proxy
          // confines this session to password/security setup, then MFA enable
          // increments sessionVersion and forces a new sign-in.
          authAssurance = "PASSWORD_ENROLLMENT";
        }

        const authenticatedAt = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: authenticatedAt },
        });
        await recordSecurityEvent({
          action: SECURITY_EVENT_ACTION.LOGIN_SUCCESS,
          userId: user.id,
          request,
          details: { role: user.role, method: authAssurance.toLowerCase() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          gpPracticeId: user.gpPracticeId,
          requiresPasswordChange: requiresPasswordUpdate(user),
          passwordExpiresAt: user.passwordExpiresAt?.toISOString() ?? null,
          twoFAEnabled: user.twoFAEnabled,
          authenticatedAt: authenticatedAt.toISOString(),
          lastActivityAt: authenticatedAt.toISOString(),
          requiresTwoFactorSetup: requiresTwoFactorSetup(user),
          sessionVersion: user.sessionVersion,
          authAssurance,
        } satisfies AuthenticatedUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const signedInUser = user as AuthenticatedUser | undefined;
      if (signedInUser) {
        token.id = signedInUser.id;
        token.role = signedInUser.role;
        token.gpPracticeId = signedInUser.gpPracticeId;
        token.requiresPasswordChange = signedInUser.requiresPasswordChange;
        token.passwordExpiresAt = signedInUser.passwordExpiresAt;
        token.twoFAEnabled = signedInUser.twoFAEnabled;
        token.authenticatedAt = signedInUser.authenticatedAt;
        token.lastActivityAt = signedInUser.lastActivityAt;
        token.requiresTwoFactorSetup = signedInUser.requiresTwoFactorSetup;
        token.sessionVersion = signedInUser.sessionVersion;
        token.authAssurance = signedInUser.authAssurance;
        token.sessionInvalid = false;
        token.sessionInvalidReason = null;
      }

      if (token.id) {
        await ensureDatabaseReady();
        const boundary = evaluateRuntimeBoundary();
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            email: true,
            role: true,
            gpPracticeId: true,
            passwordChangeRequired: true,
            passwordExpiresAt: true,
            twoFAEnabled: true,
            isActive: true,
            isDemoAccount: true,
            sessionVersion: true,
          },
        });

        const issuedVersion = Number(token.sessionVersion);
        let invalidReason: string | null = null;
        if (!currentUser) invalidReason = "account_missing";
        else if (!currentUser.isActive) invalidReason = "account_disabled";
        else if (!Number.isSafeInteger(issuedVersion) || issuedVersion !== currentUser.sessionVersion) {
          invalidReason = "session_revoked";
        } else if (
          boundary.mode === "PILOT" &&
          (currentUser.isDemoAccount || isDemoAccountEmail(currentUser.email))
        ) {
          invalidReason = "demo_identity_prohibited";
        } else if (boundary.mode === "PILOT" && !boundary.ready) {
          invalidReason = "pilot_configuration_blocked";
        } else if (
          boundary.mode === "PILOT" &&
          boundary.pilotIdleTimeoutMinutes &&
          boundary.pilotReauthMinutes
        ) {
          const sessionState = evaluatePilotSession({
            authenticatedAt: token.authenticatedAt as string | null | undefined,
            lastActivityAt: token.lastActivityAt as string | null | undefined,
            idleTimeoutMinutes: boundary.pilotIdleTimeoutMinutes,
            reauthMinutes: boundary.pilotReauthMinutes,
          });
          if (!sessionState.valid) invalidReason = sessionState.reason;
        }

        token.sessionInvalid = Boolean(invalidReason);
        token.sessionInvalidReason = invalidReason;
        if (currentUser && !invalidReason) {
          token.role = currentUser.role;
          token.gpPracticeId = currentUser.gpPracticeId;
          token.requiresPasswordChange = requiresPasswordUpdate(currentUser);
          token.passwordExpiresAt = currentUser.passwordExpiresAt?.toISOString() ?? null;
          token.twoFAEnabled = currentUser.twoFAEnabled;
          token.requiresTwoFactorSetup =
            boundary.mode === "PILOT" && requiresTwoFactorSetup(currentUser);
          token.lastActivityAt = new Date().toISOString();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          id: token.id as string,
          role: token.role as string,
          gpPracticeId: (token.gpPracticeId as string | null) ?? null,
          requiresPasswordChange: Boolean(token.requiresPasswordChange),
          passwordExpiresAt: (token.passwordExpiresAt as string | null) ?? null,
          twoFAEnabled: Boolean(token.twoFAEnabled),
          authenticatedAt: (token.authenticatedAt as string | null) ?? null,
          lastActivityAt: (token.lastActivityAt as string | null) ?? null,
          requiresTwoFactorSetup: Boolean(token.requiresTwoFactorSetup),
          authAssurance: (token.authAssurance as string | null) ?? null,
          sessionInvalid: Boolean(token.sessionInvalid),
          sessionInvalidReason: (token.sessionInvalidReason as string | null) ?? null,
        });
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: {
    strategy: "jwt",
    // Pilot idle and re-auth windows are explicitly configured and enforced in
    // the JWT callback. This absolute cap remains a framework-level backstop.
    maxAge: 8 * 60 * 60,
  },
});
