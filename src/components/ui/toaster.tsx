"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "glass min-w-[280px] rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-2",
            t.variant === "destructive" && "border-destructive/50"
          )}
        >
          <div className="flex justify-between gap-2">
            <div>
              {t.title && <p className="font-semibold text-sm">{t.title}</p>}
              {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
