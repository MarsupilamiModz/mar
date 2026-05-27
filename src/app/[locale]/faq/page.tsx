import { setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";

const faqs = [
  {
    q: "How do premium downloads work?",
    a: `Subscribe to ${SITE.name} Premium or purchase individual mods. Downloads use secure signed URLs that expire after a few minutes to protect creators.`,
  },
  {
    q: "Which games are supported?",
    a: "GTA V / FiveM, Minecraft, Euro Truck Simulator 2, BeamNG.drive, and Assetto Corsa at launch. New games are added by our team as the catalog grows.",
  },
  {
    q: "How does Discord integration work?",
    a: "Link Discord via OAuth during login or from your dashboard. Premium and Creator roles sync automatically to our community server.",
  },
  {
    q: "Can I become a creator?",
    a: "Apply from your dashboard once registered. Verified creators can publish mods, manage versions, and view download analytics.",
  },
];

export default function FaqPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">FAQ</h1>
      <div className="mt-10 space-y-4">
        {faqs.map((f) => (
          <Card key={f.q} className="glass p-6">
            <h2 className="font-semibold">{f.q}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
