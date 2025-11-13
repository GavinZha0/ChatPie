import { selectThreadWithMessagesAction } from "@/app/api/chat/actions";
import ChatBot from "@/components/chat-bot";

import { ChatMessage, ChatThread, MyUIMessage } from "app-types/chat";
import { redirect, RedirectType } from "next/navigation";

const fetchThread = async (
  threadId: string,
): Promise<(ChatThread & { messages: ChatMessage[] }) | null> => {
  return await selectThreadWithMessagesAction(threadId);
};

export default async function Page({
  params,
}: { params: Promise<{ thread: string }> }) {
  const { thread: threadId } = await params;

  const thread = await fetchThread(threadId);

  if (!thread) redirect("/", RedirectType.replace);

  // Type cast: ChatMessage has UIMessage["parts"] which at runtime contains our custom data types
  // (agent-tag, agent-finish), but TypeScript doesn't know this. Cast to MyUIMessage for type safety.
  return (
    <ChatBot
      threadId={threadId}
      initialMessages={thread.messages as MyUIMessage[]}
    />
  );
}
