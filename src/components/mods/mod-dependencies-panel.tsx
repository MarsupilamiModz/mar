"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle } from "lucide-react";
import type { Locale } from "@/i18n/config";

type Dep = {
  id: string;
  isRequired: boolean;
  minVersion: string | null;
  notes: string | null;
  dependency: {
    id: string;
    slug: string;
    title: string;
    status: string;
    game: { name: string; slug: string };
    versions: { version: string; gameVersion: string | null }[];
  };
};

type Props = {
  locale: Locale;
  required: Dep[];
  optional: Dep[];
  conflicts?: Dep[];
  missing: Dep[];
};

export function ModDependenciesPanel({ locale, required, optional, conflicts = [], missing }: Props) {
  const [pending, startTransition] = useTransition();
  const [showMissing, setShowMissing] = useState(missing.length > 0);

  function downloadDependencies() {
    startTransition(async () => {
      const ids = missing.map((m) => m.dependency.id);
      if (ids.length === 0) return;

      for (const id of ids) {
        const res = await fetch(`/api/mods/${id}/download`, { method: "POST" });
        if (res.ok) {
          const { url } = await res.json();
          window.open(url, "_blank");
        }
      }

      await fetch("/api/mods/dependencies/bulk-favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modIds: ids }),
      });

      toast({ title: "Dependencies added to library" });
      setShowMissing(false);
    });
  }

  if (required.length === 0 && optional.length === 0 && conflicts.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Dependencies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {conflicts.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Incompatible mods</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {conflicts.map((d) => (
                    <li key={d.id}>
                      <Link href={`/${locale}/mods/${d.dependency.slug}`} className="hover:underline">
                        {d.dependency.title}
                      </Link>
                      {d.notes && <span className="text-muted-foreground"> — {d.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        {showMissing && missing.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">This mod requires:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {missing.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/${locale}/mods/${d.dependency.slug}`}
                        className="text-neon-purple hover:underline"
                      >
                        {d.dependency.title}
                      </Link>
                      {d.minVersion && (
                        <span className="text-muted-foreground"> (min v{d.minVersion})</span>
                      )}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  className="mt-3"
                  variant="neon"
                  disabled={pending}
                  onClick={downloadDependencies}
                >
                  Download required dependencies
                </Button>
              </div>
            </div>
          </div>
        )}

        {required.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Required</p>
            <ul className="space-y-2">
              {required.map((d) => (
                <DependencyRow key={d.id} locale={locale} dep={d} />
              ))}
            </ul>
          </div>
        )}

        {optional.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Optional</p>
            <ul className="space-y-2">
              {optional.map((d) => (
                <DependencyRow key={d.id} locale={locale} dep={d} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DependencyRow({ locale, dep }: { locale: Locale; dep: Dep }) {
  const v = dep.dependency.versions[0];
  return (
    <li className="flex items-center justify-between text-sm border-b border-border/20 pb-2">
      <Link
        href={`/${locale}/mods/${dep.dependency.slug}`}
        className="font-medium hover:text-neon-purple"
      >
        {dep.dependency.title}
      </Link>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {v && <span>v{v.version}</span>}
        {v?.gameVersion && <Badge variant="outline">{v.gameVersion}</Badge>}
        {dep.minVersion && <span>min {dep.minVersion}</span>}
      </div>
    </li>
  );
}
