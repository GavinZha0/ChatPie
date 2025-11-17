"use client";

import { isToolUIPart, type UIMessage } from "ai";
import { memo, useMemo, useState } from "react";
import equal from "lib/equal";

import { cn } from "lib/utils";
import type { ChatWidthMode } from "@/app/store";
import type { UseChatHelpers } from "@ai-sdk/react";
import {
  UserMessagePart,
  AssistMessagePart,
  ToolMessagePart,
  ReasoningPart,
  FileMessagePart,
  SourceUrlMessagePart,
} from "./message-parts";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChatMetadata } from "app-types/chat";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  message: UIMessage;
  prevMessage?: UIMessage;
  threadId?: string;
  isLoading?: boolean;
  isLastMessage?: boolean;
  setMessages?: UseChatHelpers<UIMessage>["setMessages"];
  sendMessage?: UseChatHelpers<UIMessage>["sendMessage"];
  className?: string;
  addToolResult?: UseChatHelpers<UIMessage>["addToolResult"];
  messageIndex?: number;
  status?: UseChatHelpers<UIMessage>["status"];
  readonly?: boolean;
  widthMode?: ChatWidthMode;
  containerWidthClassName?: string;
}

const PurePreviewMessage = ({
  message,
  prevMessage,
  readonly,
  threadId,
  isLoading,
  isLastMessage,
  status,
  className,
  setMessages,
  addToolResult,
  messageIndex,
  sendMessage,
  widthMode = "centered",
  containerWidthClassName,
}: Props) => {
  const isUserMessage = useMemo(() => message.role === "user", [message.role]);
  const partsForDisplay = useMemo(
    () =>
      message.parts.filter((part) => {
        if (part.type === "text" && (part as any).ingestionPreview)
          return false;
        if (part.type === "data-agent-tag") return false;
        if (part.type === "data-agent-finish") return false;
        if (part.type === "step-start") return false;
        return true;
      }),
    [message.parts],
  );

  if (message.role == "system") {
    return null; // system message is not shown
  }
  if (!partsForDisplay.length) return null;

  return (
    <div
      className={cn(
        "w-full mx-auto group/message",
        containerWidthClassName ??
          (widthMode === "wide" ? "max-w-none px-10" : "max-w-4xl px-6"),
      )}
    >
      <div className={cn("flex gap-4 w-full", className)}>
        <div className="flex flex-col gap-4 w-full">
          {(() => {
            const partsWithIndex = partsForDisplay.map((p, i) => ({
              part: p,
              index: i,
            }));
            const lastIndex = partsWithIndex.length - 1;
            const reasoningParts = partsWithIndex.filter(
              (p) => p.part.type === "reasoning",
            );
            const otherParts = partsWithIndex.filter(
              (p) => p.part.type !== "reasoning",
            );

            const renderPart = ({
              part,
              index,
            }: { part: any; index: number }) => {
              const key = `message-${messageIndex}-part-${part.type}-${index}`;
              const isLastPart = index === lastIndex;

              if (part.type === "reasoning") {
                return (
                  <ReasoningPart
                    key={key}
                    readonly={readonly}
                    reasoningText={part.text}
                    isThinking={isLastPart && isLastMessage && isLoading}
                  />
                );
              }

              if (isUserMessage && part.type === "text" && part.text) {
                return (
                  <UserMessagePart
                    key={key}
                    status={status}
                    part={part}
                    readonly={readonly}
                    isLast={isLastPart}
                    message={message}
                    setMessages={setMessages}
                    sendMessage={sendMessage}
                  />
                );
              }

              if (part.type === "text" && !isUserMessage) {
                return (
                  <AssistMessagePart
                    threadId={threadId}
                    isLast={isLastMessage && isLastPart}
                    isLoading={isLoading}
                    key={key}
                    readonly={readonly}
                    part={part}
                    prevMessage={prevMessage}
                    showActions={
                      isLastMessage ? isLastPart && !isLoading : isLastPart
                    }
                    message={message}
                    setMessages={setMessages}
                    sendMessage={sendMessage}
                  />
                );
              }

              if (isToolUIPart(part)) {
                const isLast = isLastMessage && isLastPart;
                const isManualToolInvocation =
                  (message.metadata as ChatMetadata)?.toolChoice == "manual" &&
                  isLastMessage &&
                  isLastPart &&
                  part.state == "input-available" &&
                  isLoading &&
                  !readonly;
                return (
                  <ToolMessagePart
                    isLast={isLast}
                    readonly={readonly}
                    messageId={message.id}
                    isManualToolInvocation={isManualToolInvocation}
                    showActions={
                      !readonly &&
                      (isLastMessage ? isLastPart && !isLoading : isLastPart)
                    }
                    addToolResult={addToolResult}
                    key={key}
                    part={part}
                    setMessages={setMessages}
                  />
                );
              } else if (part.type === "step-start") {
                return null;
              } else if (
                part.type === "data-agent-tag" ||
                part.type === "data-agent-finish"
              ) {
                return null;
              } else if (part.type === "file") {
                return (
                  <FileMessagePart
                    key={key}
                    part={part}
                    isUserMessage={isUserMessage}
                  />
                );
              } else if ((part as any).type === "source-url") {
                return (
                  <SourceUrlMessagePart
                    key={key}
                    part={part as any}
                    isUserMessage={isUserMessage}
                  />
                );
              } else {
                return <div key={key}> unknown part {part.type}</div>;
              }
            };

            return (
              <>
                {reasoningParts.map(renderPart)}
                {otherParts.map(renderPart)}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  function equalMessage(prevProps: Props, nextProps: Props) {
    if (prevProps.message.id !== nextProps.message.id) return false;

    if (prevProps.isLoading !== nextProps.isLoading) return false;

    if (prevProps.isLastMessage !== nextProps.isLastMessage) return false;

    if (prevProps.className !== nextProps.className) return false;

    if (prevProps.widthMode !== nextProps.widthMode) return false;

    if (nextProps.isLoading && nextProps.isLastMessage) return false;

    if (!equal(prevProps.message.metadata, nextProps.message.metadata))
      return false;

    if (prevProps.message.parts.length !== nextProps.message.parts.length) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }

    return true;
  },
);

// Animation variants for collapsible content
const errorVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  expanded: {
    height: "auto",
    opacity: 1,
    marginTop: "1rem",
    marginBottom: "0.5rem",
  },
};

export const ErrorMessage = ({
  error,
  widthMode = "centered",
}: {
  error: Error;
  message?: UIMessage;
  widthMode?: ChatWidthMode;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const t = useTranslations();

  return (
    <div
      className={cn(
        "w-full mx-auto animate-in fade-in mt-4",
        widthMode === "wide" ? "max-w-none px-10" : "max-w-4xl px-6",
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 opacity-70">
          <div className="flex flex-col">
            <div
              className="flex flex-row gap-2 items-center text-destructive hover:text-destructive/80 transition-colors cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="p-1.5 bg-muted rounded-sm">
                <TriangleAlertIcon className="size-3.5" />
              </div>
              <div className="font-medium text-sm">{t("Chat.Error")}</div>
              <button type="button" className="cursor-pointer">
                <ChevronDownIcon
                  size={16}
                  className={cn(
                    "transition-transform duration-200",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>
            </div>

            <div className="pl-4">
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="error-content"
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    variants={errorVariants}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                    className="pl-6 text-muted-foreground border-l border-destructive/30 flex flex-col gap-4"
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {error.message}
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      {t("Chat.thisMessageWasNotSavedPleaseTryTheChatAgain")}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
