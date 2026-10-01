import { PageHeader } from "@/components/shared/page-header";
import { ChatBoard } from "@/components/phase3/boards";
import { requireSession } from "@/lib/auth/session";
import { getChatWorkspace } from "@/lib/db/phase3";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const user = await requireSession();
  if (!user.permissions.includes("chat.use")) {
    return (
      <PageHeader title="Chat" description="Your role does not include chat." />
    );
  }
  const { room } = await searchParams;
  const data = await getChatWorkspace();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Chat"
        description="Direct and group messages stay inside the conversation. Admins do not read private messages they are not a member of."
      />
      <ChatBoard
        rooms={data.rooms}
        messages={data.messages}
        profiles={data.profiles}
        currentUserId={data.actor.id}
        canCreateGroup={data.canCreateGroup}
        initialRoomId={room}
      />
    </div>
  );
}
