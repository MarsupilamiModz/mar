"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Shield,
  LifeBuoy,
  User,
  Palette,
  Package,
  Handshake,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { isStaff, isDesigner, isCreator, isPartner } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";
import { formatDisplayName } from "@/lib/display-name";

const NotificationCenter = dynamic(
  () => import("@/components/layout/notification-center").then((m) => m.NotificationCenter),
  { ssr: false, loading: () => null }
);

export type NavUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isPremium: boolean;
  permissions?: import("@/lib/permissions").PermissionKey[];
};

export function UserNav({ locale, user }: { locale: string; user: NavUser }) {
  const router = useRouter();
  const displayName = formatDisplayName(user);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <NotificationCenter locale={locale} userId={user.id} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <UserAvatar src={user.avatarUrl} name={displayName} className="h-8 w-8 border border-neon-purple/30" />
          <span className="hidden sm:inline text-sm font-medium max-w-[160px] truncate">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass">
        <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/dashboard`} className="cursor-pointer">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/dashboard/support`} className="cursor-pointer">
            <LifeBuoy className="mr-2 h-4 w-4" /> Support
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/dashboard/settings`} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        {isCreator(user.role) && (
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/creator`} className="cursor-pointer">
              <Package className="mr-2 h-4 w-4" /> Creator Studio
            </Link>
          </DropdownMenuItem>
        )}
        {isPartner(user.role) && (
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/partner`} className="cursor-pointer">
              <Handshake className="mr-2 h-4 w-4" /> Partner Studio
            </Link>
          </DropdownMenuItem>
        )}
        {isDesigner(user.role) && (
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/designer`} className="cursor-pointer">
              <Palette className="mr-2 h-4 w-4" /> Design Studio
            </Link>
          </DropdownMenuItem>
        )}
        {isStaff(user.role) && (
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/admin`} className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" /> Admin Panel
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
