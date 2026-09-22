import type { Permission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import { isDeniedInEvaluationMode, isEvaluationAccount } from "@/lib/auth/evaluation-mode";

type SessionUserLike = {
  id?: string;
  role?: string;
  email?: string | null;
} | null | undefined;

export function getApiPermissionError(
  user: SessionUserLike,
  permission: Permission
) {
  if (!user?.id) {
    return {
      status: 401,
      body: { error: "Unauthorised" },
    };
  }

  // The evaluation boundary is a deny layer over the role, and it is applied
  // before the grant so a broad role cannot widen it. Hiding a control in the
  // UI is presentation; this is where the capability is actually withheld.
  if (isEvaluationAccount(user) && isDeniedInEvaluationMode(permission)) {
    return {
      status: 403,
      body: {
        error:
          "Not available in the controlled clinical evaluation. This account can review cases and record decisions; it cannot change rules, accounts or the supplied case set.",
      },
    };
  }

  if (!hasPermission(user.role, permission)) {
    return {
      status: 403,
      body: { error: "Forbidden" },
    };
  }

  return null;
}
