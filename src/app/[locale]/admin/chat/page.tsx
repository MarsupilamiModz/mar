import { listChatChannelsForUser } from "@/actions/team-chat";
import { AdminChatPageClient } from "@/components/chat/admin-chat-page-client";
import { requirePagePermission } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ channel?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const user = await requirePagePermission("team.chat");
  const result = await listChatChannelsForUser();

  const data = result.success
    ? result.data
    : { channels: [], teammates: [] };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Team Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal staff messaging — channels, departments, and direct messages
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
