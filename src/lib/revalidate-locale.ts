import { locales } from "@/i18n/config";
import { revalidatePath } from "next/cache";

/** Revalidate a path for every supported locale (fixes stale localized mod pages). */
export function revalidateLocalizedPaths(pathWithoutLocale: string) {
  const clean = pathWithoutLocale.startsWith("/") ? pathWithoutLocale : `/${pathWithoutLocale}`;
  revalidatePath(clean);
  for (const locale of locales) {
    revalidatePath(`/${locale}${clean === "/" ? "" : clean}`);
  }
}
