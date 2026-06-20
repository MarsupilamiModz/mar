import type { ZodError } from "zod";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin, isStaff, type PermissionKey } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permission-store";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

export function formatZodError(error: ZodError): string {
  const first = error.errors[0];
  if (!first) return "Validation failed";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}

import { formatActionError } from "@/lib/error-diagnostics";

export { prismaErrorMessage } from "@/lib/errors";

export async function actionTry<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    if (context) {
      const { logPlatformError } = await import("@/lib/platform-log");
      void logPlatformError(context, err);
    }
    return fail(formatActionError(err, context));
  }
}

export async function requireActionUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null as never, error: fail("Unauthorized") };
  if (user.deletedAt) return { user: null as never, error: fail("Account deleted") };
  if (user.isBanned) return { user: null as never, error: fail("Account banned") };
  return { user, error: null };
}

export async function requireActionPermission(permission: PermissionKey) {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  const allowed = await userHasPermission(
    { id: user.id, role: user.role, permissionGroupId: user.permissionGroupId },
    permission
  );
  if (!allowed) {
    return { user: null as never, error: fail("Forbidden") };
  }
  return { user, error: null };
}

export async function requireAnyActionPermission(...permissions: PermissionKey[]) {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  for (const permission of permissions) {
    const allowed = await userHasPermission(
      { id: user.id, role: user.role, permissionGroupId: user.permissionGroupId },
      permission
    );
    if (allowed) return { user, error: null };
  }
  return { user: null as never, error: fail("Forbidden") };
}

export async function requireActionAdmin() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (!isAdmin(user.role)) return { user: null as never, error: fail("Forbidden") };
  return { user, error: null };
}

export async function requireActionStaff() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (!isStaff(user.role)) return { user: null as never, error: fail("Forbidden") };
  return { user, error: null };
}

export async function requireActionOwner() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (user.role !== "OWNER") return { user: null as never, error: fail("Owner access only") };
  return { user, error: null };
}

export function canManageRole(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN" && targetRole !== "OWNER") return true;
  return false;
}
