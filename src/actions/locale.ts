"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, requireActionUser } from "@/lib/action-utils";
import { isValidLocale, type Locale } from "@/i18n/config";

export async function persistUserLocale(locale: string) {
  if (!isValidLocale(locale)) return ok(undefined);

  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const { user, error } = await requireActionUser();
  if (error) return ok(undefined);

  if (user.locale !== locale) {
    await prisma.user.update({
      where: { id: user.id },
      data: { locale: locale as Locale },
    });
  }

  revalidatePath("/", "layout");
  return ok(undefined);
}
