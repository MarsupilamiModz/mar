"use client";

import { useState, useTransition } from "react";
import { ModDependencyRelation } from "@prisma/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addModDependency,
  removeModDependency,
  searchModsForDependency,
} from "@/actions/mod-dependencies";

type Dep = {
  id: string;
  dependencyId: string;
  isRequired: boolean;
  relation: ModDependencyRelation;
  dependency: { id: string; title: string; slug: string };
};

const RELATION_LABELS: Record<ModDependencyRelation, string> = {
  REQUIRED: "Required",
  OPTIONAL: "Optional",
  CONFLICT: "Incompatible",
};

export function CreatorModDependenciesEditor({
  modId,
  gameId,
  initial,
}: {
  modId: string;
  gameId: string;
  initial: Dep[];
}) {
  const [deps, setDeps] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [relation, setRelation] = useState<ModDependencyRelation>("REQUIRED");
  const [minVersion, setMinVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      const r = await searchModsForDependency(query, gameId);
      if (r.success) setResults(r.data.filter((m) => m.id !== modId));
    });
  }

  function add(dependencyId: string) {
    startTransition(async () => {
      const r = await addModDependency(
        modId,
        dependencyId,
        relation === "REQUIRED",
        minVersion.trim() || undefined,
        notes.trim() || undefined,
        relation
      );
      if (r.success) {
        toast({ title: "Dependency added" });
        window.location.reload();
      } else toast({ title: r.error, variant: "destructive" });
    });
  }

  function remove(dependencyId: string) {
    startTransition(async () => {
      const r = await removeModDependency(modId, dependencyId);
      if (r.success) {
        setDeps((d) => d.filter((x) => x.dependencyId !== dependencyId));
        toast({ title: "Removed" });
      }
    });
  }

  return (
    <Card className="glass">
      <CardHeader><CardTitle>Dependencies</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {deps.length === 0 ? (
            <li className="text-muted-foreground">No dependencies defined.</li>
          ) : (
            deps.map((d) => (
              <li key={d.id} className="flex justify-between items-center">
                <span>
                  {d.dependency.title}
                  <span
                    className={`ml-2 ${
                      d.relation === "CONFLICT" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    ({RELATION_LABELS[d.relation] ?? (d.isRequired ? "required" : "optional")})
                  </span>
                </span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(d.dependencyId)}>
                  Remove
                </Button>
              </li>
            ))
          )}
        </ul>

        <div className="space-y-2 border-t border-border/30 pt-4">
          <label className="text-sm font-medium">Add dependency</label>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mods…"
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button variant="outline" disabled={pending} onClick={search}>
              Search
            </Button>
          </div>
          <Select value={relation} onValueChange={(v) => setRelation(v as ModDependencyRelation)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REQUIRED">Required dependency</SelectItem>
              <SelectItem value="OPTIONAL">Optional dependency</SelectItem>
              <SelectItem value="CONFLICT">Incompatible mod (conflict)</SelectItem>
            </SelectContent>
          </Select>
          {relation !== "CONFLICT" && (
            <Input
              value={minVersion}
              onChange={(e) => setMinVersion(e.target.value)}
              placeholder="Minimum version (e.g. 2.0.0)"
            />
          )}
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Compatibility notes (optional)"
          />
          {results.length > 0 && (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {results.map((m) => (
                <li key={m.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    disabled={pending}
                    onClick={() => add(m.id)}
                  >
                    {m.title}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
