import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFoundPage({
  params,
}: {
  params?: { locale?: string };
}) {
  const locale = params?.locale ?? "en";
  const t = await getTranslations("common");

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-6xl font-bold text-gradient">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("notFoundHint")}</p>
      <Button variant="neon" className="mt-6" asChild>
        <Link href={`/${locale}`}>{t("backHome")}</Link>
      </Button>
    </div>
  );
}
