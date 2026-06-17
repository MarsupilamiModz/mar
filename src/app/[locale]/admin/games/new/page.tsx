import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GameForm } from "@/components/admin/game-form";
import type { Locale } from "@/i18n/config";

export default async function NewGamePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  return (
    <div>
      <Link href={`/${locale}/admin/games`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold mb-6">Add Game</h1>
      <GameForm locale={locale} />
    </div>
  );
}
