"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Crown,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { UserIdentity } from "@/components/user/user-identity";

import type { InlineBadge } from "@/lib/user-badges";

export type NavUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isPremium: boolean;
  badges?: InlineBadge[];
};

export function UserNav({ locale, user }: { locale: string; user: NavUser }) {
  const router = useRouter();
  const initials = formatDisplayName(user).slice(0, 2).toUpperCase();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8 border border-neon-purple/30">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
            <AvatarFallback className="bg-neon-purple/20 text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium max-w-[160px]">
            <UserIdentity
              username={user.username}
              displayName={user.displayName}
              badges={user.badges ?? []}
              className="min-w-0"
            />
          </span>
          {user.isPremium && (
            <Badge variant="premium" className="hidden sm:inline-flex text-[10px] px-1.5">
              <Crown className="h-3 w-3 mr-0.5" /> PRO
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass">
        <DropdownMenuLabel>
          <UserIdentity username={user.username} displayName={user.displayName} badges={user.badges ?? []} />
        </DropdownMenuLabel>
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
  );
}
