"use client";

import { useTranslations } from "next-intl";
import { toast } from "@/hooks/use-toast";
import { parseAppError } from "@/lib/error-diagnostics";

export function useAppToast() {
  const t = useTranslations("toast");

  return {
    saved: (description?: string) => toast({ title: t("saved"), description }),
    deleted: (description?: string) => toast({ title: t("deleted"), description }),
    created: (description?: string) => toast({ title: t("created"), description }),
    updated: (description?: string) => toast({ title: t("updated"), description }),
    error: (description?: string | unknown) => {
      if (typeof description === "string" || description === undefined) {
        toast({
          title: t("error"),
          description: description ?? undefined,
          variant: "destructive",
        });
        return;
      }
      const diagnostics = parseAppError(description);
      toast({
        title: t("error"),
        description: `${diagnostics.message}${diagnostics.hint ? ` — ${diagnostics.hint}` : ""}`,
        variant: "destructive",
      });
    },
    copied: () => toast({ title: t("copied") }),
    uploaded: () => toast({ title: t("uploaded") }),
    raw: toast,
  };
}
