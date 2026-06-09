"use client";

import { useState, useTransition } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addModDependency,
  removeModDependency,
  searchModsForDependency,
} from "@/actions/mod-dependencies";
type Dep = {
  id: string;
  dependencyId: string;
  isRequired: boolean;
  dependency: { id: string; title: string; slug: string };
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
  const [isRequired, setIsRequired] = useState(true);
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
        isRequired,
        minVersion.trim() || undefined,
        notes.trim() || undefined
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
                  <span className="text-muted-foreground ml-2">
                    ({d.isRequired ? "required" : "optional"})
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
          <div className="flex items-center gap-2">
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            <label className="text-sm font-medium">Required</label>
          </div>
          <Input
            value={minVersion}
            onChange={(e) => setMinVersion(e.target.value)}
            placeholder="Minimum version (e.g. 2.0.0)"
          />
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
