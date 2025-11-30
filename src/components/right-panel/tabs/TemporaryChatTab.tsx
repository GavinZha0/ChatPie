"use client";

import { appStore } from "@/app/store";
import { useChat, UseChatHelpers } from "@ai-sdk/react";
import { cn } from "lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PromptInput from "@/components/prompt-input";
import { ErrorMessage, PreviewMessage } from "@/components/message";
import { DefaultChatTransport, UIMessage } from "ai";
import { useShallow } from "zustand/shallow";
import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import { useTranslations } from "next-intl";
import { Think } from "ui/think";

export function TemporaryChatTab() {
  const t = useTranslations("Chat.TemporaryChat");

  const [temporaryChat, rightPanelRuntime, appStoreMutate] = appStore(
    useShallow((state) => [
      state.temporaryChat,
      state.rightPanelRuntime,
      state.mutate,
    ]),
  );

  const [input, setInput] = useState("");

  const {
    messages,
    sendMessage,
    clearError,
    status,
    setMessages,
    error,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/temporary",
      prepareSendMessagesRequest: ({ messages }) => {
        const temporaryChat = appStore.getState().temporaryChat;
        return {
          body: {
            chatModel: temporaryChat.chatModel,
            instructions: temporaryChat.instructions,
            messages,
          },
        };
      },
    }),
    experimental_throttle: 100,
    onError: () => {
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  useEffect(() => {
    const runtime = (rightPanelRuntime || {}) as Record<string, any>;
    const saved = runtime["tempchat"] || {};
    const savedMessages = saved.messages as UIMessage[] | undefined;
    const savedInput = saved.input as string | undefined;
    if (
      Array.isArray(savedMessages) &&
      savedMessages.length > 0 &&
      messages.length === 0
    ) {
      setMessages(savedMessages);
    }
    if (
      typeof savedInput === "string" &&
      savedInput.length > 0 &&
      input.length === 0
    ) {
      setInput(savedInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    appStoreMutate((prev) => ({
      rightPanelRuntime: {
        ...(prev.rightPanelRuntime || {}),
        tempchat: {
          ...((prev.rightPanelRuntime || {}).tempchat || {}),
          messages,
          input,
        },
      },
    }));
  }, [messages, input, appStoreMutate]);

  const isLoading = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  const reset = useCallback(() => {
    setMessages([]);
    clearError();
    appStoreMutate((prev) => ({
      rightPanelRuntime: {
        ...(prev.rightPanelRuntime || {}),
        tempchat: {
          ...((prev.rightPanelRuntime || {}).tempchat || {}),
          messages: [],
          input: "",
        },
      },
    }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutEvent(e, Shortcuts.toggleTemporaryChat)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        appStoreMutate((prev) => ({
          temporaryChat: {
            ...prev.temporaryChat,
            isOpen: !prev.temporaryChat.isOpen,
          },
        }));
      } else if (
        temporaryChat.isOpen &&
        isShortcutEvent(e, {
          shortcut: {
            command: true,
            key: "e",
          },
        })
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [temporaryChat.isOpen]);

  return (
    <div className="h-full flex flex-col" style={{ userSelect: "text" }}>
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
        <span className="text-sm font-semibold text-foreground">
          {t("temporaryChat")}
        </span>
      </div>
      <TemporaryChatContent
        isLoading={isLoading}
        messages={messages}
        error={error}
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        setMessages={setMessages}
        stop={stop}
        status={status}
        onTemporaryReset={reset}
      />
    </div>
  );
}

function TemporaryChatContent({
  messages,
  input,
  setInput,
  sendMessage,
  status,
  error,
  isLoading,
  setMessages,
  stop,
  onTemporaryReset,
}: {
  messages: UIMessage[];
  input: string;
  setInput: (input: string) => void;
  sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
  status: "submitted" | "streaming" | "ready" | "error";
  isLoading: boolean;
  error: Error | undefined;
  setMessages: UseChatHelpers<UIMessage>["setMessages"];
  stop: UseChatHelpers<UIMessage>["stop"];
  onTemporaryReset?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Chat");
  const autoScrollRef = useRef(false);

  const [temporaryChat, appStoreMutate] = appStore(
    useShallow((state) => [state.temporaryChat, state.mutate]),
  );

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current?.scrollHeight,
    });
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) {
      containerRef.current?.scrollTo({
        top: containerRef.current?.scrollHeight,
      });
    }
  }, [messages]);

  useEffect(() => {
    if (isLoading) {
      autoScrollRef.current = true;
      const handleScroll = () => {
        const el = containerRef.current!;
        const isAtBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight < 20;
        if (!isAtBottom) {
          autoScrollRef.current = false;
        }
      };
      containerRef.current?.addEventListener("scroll", handleScroll);
      return () => {
        containerRef.current?.removeEventListener("scroll", handleScroll);
      };
    }
  }, [isLoading]);

  const setModel = useCallback((model) => {
    appStoreMutate({
      temporaryChat: {
        ...temporaryChat,
        chatModel: model,
      },
    });
  }, []);

  useEffect(() => {
    if (!temporaryChat.chatModel) {
      appStoreMutate((state) => {
        if (!state.chatModel) return state;
        return {
          temporaryChat: {
            ...temporaryChat,
            chatModel: state.chatModel,
          },
        };
      });
    }
  }, [Boolean(temporaryChat.chatModel)]);

  return (
    <div
      className={cn("flex flex-col min-w-0 h-full flex-1 overflow-y-hidden")}
    >
      {!messages.length && !error && (
        <div className="flex-1 items-center flex">
          <div className="max-w-3xl mx-auto my-4">
            <div className="rounded-xl p-6 flex flex-col gap-2 leading-relaxed text-center">
              <h1 className="text-4xl font-semibold ">
                {t("TemporaryChat.thisChatWontBeSaved")}
              </h1>
            </div>
          </div>
        </div>
      )}
      <div
        className={"flex flex-col gap-2 overflow-y-auto py-6"}
        ref={containerRef}
      >
        {messages.map((message, index) => {
          const isLastMessage = messages.length - 1 === index;
          return (
            <PreviewMessage
              messageIndex={index}
              key={index}
              message={message}
              status={status}
              isLoading={isLoading}
              isLastMessage={isLastMessage}
              setMessages={setMessages}
              prevMessage={messages[index - 1]}
              sendMessage={sendMessage}
            />
          );
        })}
        {(() => {
          const showThinking =
            isLoading && !messages.some((m) => m.role === "assistant");
          return showThinking ? (
            <div className={cn("w-full mx-auto", "max-w-6xl px-6")}>
              <Think />
            </div>
          ) : null;
        })()}
        {error && <ErrorMessage error={error} />}
      </div>
      <div className={"w-full mt-auto mb-14"}>
        <PromptInput
          input={input}
          sendMessage={sendMessage}
          disabledMention={true}
          model={temporaryChat.chatModel}
          setModel={setModel}
          toolDisabled
          placeholder={t("TemporaryChat.feelFreeToAskAnythingTemporarily")}
          setInput={setInput}
          voiceDisabled
          isLoading={isLoading}
          onStop={stop}
          updateGlobalModel={false}
          onTemporaryReset={onTemporaryReset}
          temporaryResetLabel={t("TemporaryChat.resetChat")}
        />
      </div>
    </div>
  );
}
