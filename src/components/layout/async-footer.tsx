import { Suspense } from "react";
import { Footer } from "@/components/layout/footer";
import { getCachedPublicBranding } from "@/lib/branding-data";

async function FooterWithBranding({ locale }: { locale: string }) {
  const bundle = await getCachedPublicBranding();
  return <Footer locale={locale} footer={bundle.footer} branding={bundle.branding} />;
}

export function AsyncFooter({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<footer className="h-48 border-t border-border/40" />}>
      <FooterWithBranding locale={locale} />
    </Suspense>
  );
}
