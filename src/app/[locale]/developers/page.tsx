import { setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export default async function DevelopersPage({
  params: { locale },
}: {
  params: { locale: Locale };
}) {
  setRequestLocale(locale);

  const endpoints = [
    { method: "GET", path: "/api/v1/mods?q=&game=&page=1", scope: "mods:read" },
    { method: "GET", path: "/api/v1/mods/{slug}", scope: "mods:read" },
    { method: "GET", path: "/api/v1/games", scope: "games:read" },
    { method: "GET", path: "/api/v1/collections", scope: "collections:read" },
    { method: "GET", path: "/api/v1/collections/{slug}", scope: "collections:read" },
    { method: "GET", path: "/api/v1/creators/{slug}", scope: "creators:read" },
    { method: "GET", path: "/api/v1/download-meta?modId=&versionId=", scope: "downloads:meta" },
    { method: "POST", path: "/api/graphql", scope: "varies" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold mb-2">Developer Portal</h1>
      <p className="text-muted-foreground mb-8">
        Public REST and GraphQL APIs for the Xumari Modz desktop client and third-party integrations.
      </p>

      <Card className="glass mb-6">
        <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Include your API key in the Authorization header:</p>
          <code className="block p-3 rounded bg-muted text-xs">
            Authorization: Bearer xm_&lt;your_api_key&gt;
          </code>
          <p className="text-muted-foreground">
            Request keys from an administrator via Admin → API Keys. Rate limits apply per key.
          </p>
        </CardContent>
      </Card>

      <Card className="glass mb-6">
        <CardHeader><CardTitle>Desktop Client Foundation</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            Use <code>/api/v1/download-meta</code> for install metadata (SHA256, version, game compatibility).
          </p>
          <p>
            Resolve dependencies via mod detail <code>/api/v1/mods/{"{slug}"}</code> before one-click installs.
          </p>
          <p>Collections support bulk library sync and sequential downloads.</p>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>REST Endpoints</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {endpoints.map((e) => (
            <div key={e.path} className="flex flex-wrap items-center gap-2 text-sm border-b border-border/30 pb-2">
              <Badge variant="outline">{e.method}</Badge>
              <code className="text-xs">{e.path}</code>
              <Badge className="text-[10px]">{e.scope}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass mt-6">
        <CardHeader><CardTitle>GraphQL</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>POST <code>/api/graphql</code> with JSON body:</p>
          <pre className="p-3 rounded bg-muted text-xs overflow-x-auto">{`{
  "query": "query { mods }",
  "variables": { "q": "redux", "page": 1 }
}`}</pre>
          <p className="text-muted-foreground">
            Supported query roots: mods, games, collections, mod (with slug variable).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
