import { redirect } from "next/navigation";
import { listChatChannelsForUser } from "@/actions/team-chat";
import { AdminChatPageClient } from "@/components/chat/admin-chat-page-client";
import { requireAuth } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/permission-store";
import { canAccessTeamChat } from "@/lib/team-chat-access";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function TeamChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ channel?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requireAuth(`/${locale}/team-chat`);
  const permissions = await getEffectivePermissions({
    id: user.id,
    role: user.role,
    permissionGroupId: user.permissionGroupId,
  });

  if (!canAccessTeamChat(user, permissions)) {
    redirect(`/${locale}/dashboard`);
  }

  const result = await listChatChannelsForUser();
  const data = result.success ? result.data : { channels: [], teammates: [] };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Team Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live internal messaging with team channels, mentions, presence, and uploads.
        </p>
      </div>
      <AdminChatPageClient
        locale={locale}
        userId={user.id}
        currentUserName={user.displayName ?? user.username}
        currentUserRole={user.role}
        initialChannels={data.channels}
        initialStaff={data.teammates}
        initialChannelId={sp.channel}
      />
    </div>
  );
}
