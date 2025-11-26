"use client";

import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { getEmojiUrl } from "lib/emoji";
import { PreviewMessage } from "@/components/message";
import { Think } from "ui/think";
import { UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";

export function TeamComparisonTab({
  agents,
  status,
}: {
  agents: Array<{
    agentId: string;
    agentName: string;
    agentIcon?: { value: string; style?: any };
    messages: UIMessage[];
  }>;
  status?: UseChatHelpers<UIMessage>["status"];
}) {
  const displayAgents = agents.slice(0, 4);
  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="h-full w-full flex gap-2">
      {displayAgents.map((agent) => {
        const lastMessage = agent.messages.at(-1);
        let space: "think" | "space" | false = false;
        if (isLoading) {
          if (lastMessage?.role === "user") {
            space = "think";
          } else {
            const lastPart = lastMessage?.parts.at(-1);
            if (!lastPart) {
              space = "think";
            } else {
              const secondPart = lastMessage?.parts[1];
              if (secondPart?.type == "text" && secondPart.text.length == 0) {
                space = "think";
              }
              if ((lastPart as any)?.type == "step-start") {
                space = lastMessage?.parts.length == 1 ? "think" : "space";
              }
            }
          }
        }

        return (
          <div
            key={agent.agentId}
            className="flex-1 min-w-0 h-full flex flex-col border-r last:border-r-0 border-border/50"
          >
            <div className="flex items-center justify-end gap-2 py-1 px-6 border-b border-border/50 bg-muted/30">
              <span className="text-sm font-semibold truncate text-right">
                {agent.agentName}
              </span>
              <Avatar className="size-6 ring ring-border rounded-full flex-shrink-0">
                <AvatarImage
                  src={
                    agent.agentIcon?.value
                      ? getEmojiUrl(agent.agentIcon.value, "apple", 64)
                      : undefined
                  }
                />
                <AvatarFallback>
                  {agent.agentName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {agent.messages.map((message, index) => {
                const isLastMessage = agent.messages.length - 1 === index;
                return (
                  <PreviewMessage
                    key={message.id}
                    message={message}
                    messageIndex={index}
                    readonly={true}
                    containerWidthClassName="max-w-none px-0"
                    className={"mb-2"}
                    isLastMessage={isLastMessage}
                    isLoading={isLoading}
                    status={status}
                  />
                );
              })}
              {space && (
                <div className={space == "space" ? "opacity-0" : ""}>
                  <Think />
                </div>
              )}
              <div className="min-h-[calc(70dvh-40px)]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
