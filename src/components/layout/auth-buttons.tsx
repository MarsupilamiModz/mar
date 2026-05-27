"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { UserNav, type NavUser } from "@/components/layout/user-nav";

export function AuthButtons({
  locale,
  user: initialUser,
}: {
  locale: string;
  user: NavUser | null;
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [user, setUser] = useState<NavUser | null>(initialUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    const supabase = createClient();

    async function syncUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        return;
      }
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch {
        /* ignore */
      }
    }

    syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      syncUser();
      router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (user) {
    return <UserNav locale={locale} user={user} />;
  }

  return (
    <>
      <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
        <Link href={`/${locale}/login`}>{t("login")}</Link>
      </Button>
      <Button variant="neon" size="sm" asChild>
        <Link href={`/${locale}/register`}>{t("getStarted")}</Link>
      </Button>
    </>
  );
}
