"use client";

import { useTranslations } from "next-intl";
import { toast } from "@/hooks/use-toast";

export function useAppToast() {
  const t = useTranslations("toast");

  return {
    saved: (description?: string) => toast({ title: t("saved"), description }),
    deleted: (description?: string) => toast({ title: t("deleted"), description }),
    created: (description?: string) => toast({ title: t("created"), description }),
    updated: (description?: string) => toast({ title: t("updated"), description }),
    error: (description?: string) => toast({ title: t("error"), description, variant: "destructive" }),
    copied: () => toast({ title: t("copied") }),
    uploaded: () => toast({ title: t("uploaded") }),
    raw: toast,
  };
}
