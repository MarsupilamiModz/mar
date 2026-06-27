import { getCreatorHostingSettings } from "@/actions/creator/hosting";
import { CreatorHostingPanel } from "@/components/creator/creator-hosting-panel";

export const dynamic = "force-dynamic";

export default async function CreatorHostingPage() {
  const result = await getCreatorHostingSettings();
  if (!result.success) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Monetarisierung · Hosting Partner</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Optionaler eigener Hosting Partner auf deinen Modpacks und Collections.
        </p>
      </div>
      <CreatorHostingPanel
        profile={result.data.profile}
        platformSettings={result.data.platformSettings}
      />
    </div>
  );
}
