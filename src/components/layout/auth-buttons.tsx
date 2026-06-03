"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { UserNav, type NavUser } from "@/components/layout/user-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UserRole } from "@prisma/client";

function sessionFallbackUser(session: {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
}): NavUser {
  const meta = session.user.user_metadata ?? {};
  const username =
    (meta.preferred_username as string | undefined) ??
    session.user.email?.split("@")[0] ??
    "user";
  return {
    id: session.user.id,
    username,
    displayName: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
    avatarUrl: (meta.avatar_url as string | undefined) ?? null,
    role: "USER" as UserRole,
    isPremium: false,
  };
}

function AuthLoadingAvatar() {
  return (
    <div className="flex items-center gap-2 px-2">
      <Avatar className="h-8 w-8 border border-neon-purple/30 animate-pulse">
        <AvatarFallback className="bg-neon-purple/10 text-xs">…</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function AuthButtons({
  locale,
  user: initialUser,
}: {
  locale: string;
  user: NavUser | null;
}) {
  const t = useTranslations("nav");
  const [user, setUser] = useState<NavUser | null>(initialUser);
  const [hasSession, setHasSession] = useState(!!initialUser);
  const [ready, setReady] = useState(!!initialUser);

  useEffect(() => {
    setUser(initialUser);
    setHasSession(!!initialUser);
    if (initialUser) setReady(true);
  }, [initialUser]);

  useEffect(() => {
    const supabase = createClient();

    async function syncUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setHasSession(false);
        setUser(null);
        setReady(true);
        return;
      }

      setHasSession(true);

      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.id) {
            setUser(data);
            setReady(true);
            return;
          }
        }
      } catch {
        /* fall through to session fallback */
      }

      setUser(sessionFallbackUser(session));
      setReady(true);
    }

    syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (hasSession) {
    if (!ready || !user) return <AuthLoadingAvatar />;
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
