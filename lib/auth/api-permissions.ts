import type { Permission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";

type SessionUserLike = {
  id?: string;
  role?: string;
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

  if (!hasPermission(user.role, permission)) {
    return {
      status: 403,
      body: { error: "Forbidden" },
    };
  }

  return null;
}
