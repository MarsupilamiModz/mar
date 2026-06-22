"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptOrderAssignment, rejectOrderAssignment } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/hooks/use-app-toast";

export function DesignerOrderActions({
  orderId,
  status,
  locale,
}: {
  orderId: string;
  status: string;
  locale: string;
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status !== "ASSIGNED") return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button
        variant="neon"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await acceptOrderAssignment(orderId, locale);
            if (!r.success) appToast.error(r.error);
            else {
              appToast.saved();
              router.refresh();
            }
          })
        }
      >
        Accept assignment
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt("Reason for rejecting (optional):") ?? "Unavailable";
          startTransition(async () => {
            const r = await rejectOrderAssignment(orderId, reason, locale);
            if (!r.success) appToast.error(r.error);
            else {
              appToast.saved();
              router.refresh();
            }
          });
        }}
      >
        Reject
      </Button>
    </div>
  );
}
