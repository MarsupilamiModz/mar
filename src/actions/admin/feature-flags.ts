"use server";

import { revalidatePath } from "next/cache";
import { ok, requireActionOwner } from "@/lib/action-utils";
import { getFeatureFlags, saveFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";
import { createAuditLog } from "@/lib/audit";

export async function getOwnerFeatureFlags() {
  const { error } = await requireActionOwner();
  if (error) return error;
  return ok(await getFeatureFlags());
}

export async function saveOwnerFeatureFlags(flags: FeatureFlags) {
  const { user, error } = await requireActionOwner();
  if (error) return error;

  await saveFeatureFlags(flags);
  await createAuditLog({
    actorId: user.id,
    action: "feature_flags.update",
    entityType: "SiteSetting",
    entityId: "feature_flags",
    metadata: flags as unknown as Record<string, unknown>,
  });
  revalidatePath("/admin/owner");
  revalidatePath("/admin/owner/features");
  return ok(undefined);
}
