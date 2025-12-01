"use client";

import { getToolName, isToolUIPart, TextPart } from "ai";
import { UIMessageWithCompleted } from "lib/ai/speech";

import {
  OPENAI_VOICE,
  useOpenAIVoiceChat as OpenAIVoiceChat,
} from "lib/ai/speech/open-ai/use-voice-chat.openai";
import { cn } from "lib/utils";
import {
  CheckIcon,
  Loader,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  PianoIcon,
  TriangleAlertIcon,
  MessagesSquareIcon,
  MessageSquareMoreIcon,
  WrenchIcon,
  ChevronRight,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { Button } from "ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";

import { MessageLoading } from "ui/message-loading";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { ToolMessagePart } from "@/components/message-parts";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "ui/dialog";
import JsonView from "ui/json-view";
import { useAgent } from "@/hooks/queries/use-agent";
import { ChatMention } from "app-types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { getEmojiUrl } from "lib/emoji";

export function VoiceChatTab() {
  const t = useTranslations("Chat");
  const [
    agentId,
    appStoreMutate,
    voiceChat,
    allowedMcpServers,
    mcpList,
    rightPanelRuntime,
  ] = appStore(
    useShallow((state) => [
      state.voiceChat.agentId,
      state.mutate,
      state.voiceChat,
      state.allowedMcpServers,
      state.mcpList,
      state.rightPanelRuntime,
    ]),
  );

  const { agent } = useAgent(agentId);

  const startAudio = useRef<HTMLAudioElement>(null);
  const endAudio = useRef<HTMLAudioElement>(null);
  const [useCompactView, setUseCompactView] = useState(true);

  const toolMentions = useMemo<ChatMention[]>(() => {
    if (!agentId) {
      if (!allowedMcpServers) return [];
      return mcpList
        .filter((v) => {
          return (
            v.id in allowedMcpServers && allowedMcpServers[v.id]?.tools?.length
          );
        })
        .flatMap((v) => {
          const tools = allowedMcpServers[v.id].tools;
          return tools.map((tool) => {
            const toolInfo = v.toolInfo.find((t) => t.name === tool);
            const mention: ChatMention = {
              type: "mcpTool",
              serverName: v.name,
              serverId: v.id,
              name: tool,
              description: toolInfo?.description ?? "",
            };
            return mention;
          });
        });
    }
    return agent?.tools?.filter((v) => v.type === "mcpTool") ?? [];
  }, [agentId, agent, mcpList, allowedMcpServers]);

  const {
    isListening,
    isAssistantSpeaking,
    isLoading,
    isActive,
    isUserSpeaking,
    messages,
    error,
    start,
    startListening,
    stop,
    stopListening,
  } = OpenAIVoiceChat({
    toolMentions,
    agentId,
    ...voiceChat.options.providerOptions,
  });

  useEffect(() => {
    appStoreMutate((prev) => ({
      rightPanelRuntime: {
        ...(prev.rightPanelRuntime || {}),
        voice: {
          ...((prev.rightPanelRuntime || {}).voice || {}),
          isActive,
          isListening,
        },
      },
    }));
  }, [isActive, isListening]);

  const startWithSound = useCallback(() => {
    if (!startAudio.current) {
      startAudio.current = new Audio("/sounds/start_voice.ogg");
    }
    start().then(() => {
      startAudio.current?.play().catch(() => {});
      startListening();
    });
  }, [start, startListening]);

  const stopWithSound = useCallback(() => {
    if (!endAudio.current) {
      endAudio.current = new Audio("/sounds/end_voice.ogg");
    }
    stop().then(() => {
      endAudio.current?.play().catch(() => {});
    });
  }, [stop]);

  const lastQuickStartRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const ts = (rightPanelRuntime || {})?.voice?.startRequestedAt as
      | number
      | undefined;
    if (!ts) return;
    if (lastQuickStartRef.current === ts) return;
    lastQuickStartRef.current = ts;
    if (!isActive) {
      startWithSound();
    } else if (!isListening) {
      startListening();
    }
  }, [
    rightPanelRuntime,
    isActive,
    isListening,
    startWithSound,
    startListening,
  ]);

  // Cleanup on unmount (if a session was started)
  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const statusMessage = useMemo(() => {
    if (isLoading) {
      return (
        <p className="fade-in animate-in duration-3000" key="start">
          {t("VoiceChat.preparing")}
        </p>
      );
    }
    if (!isActive)
      return (
        <p className="fade-in animate-in duration-3000" key="start">
          {t("VoiceChat.startVoiceChat")}
        </p>
      );
    if (!isListening)
      return (
        <p className="fade-in animate-in duration-3000" key="stop">
          {t("VoiceChat.yourMicIsOff")}
        </p>
      );
    if (!isAssistantSpeaking && messages.length === 0) {
      return (
        <p className="fade-in animate-in duration-3000" key="ready">
          {t("VoiceChat.readyWhenYouAreJustStartTalking")}
        </p>
      );
    }
    if (isUserSpeaking && useCompactView) {
      return <MessageLoading className="text-muted-foreground" />;
    }
    if (!isAssistantSpeaking && !isUserSpeaking) {
      return (
        <p className="delayed-fade-in" key="ready">
          {t("VoiceChat.readyWhenYouAreJustStartTalking")}
        </p>
      );
    }
  }, [
    isAssistantSpeaking,
    isUserSpeaking,
    isActive,
    isLoading,
    isListening,
    messages.length,
    useCompactView,
  ]);

  useEffect(() => {
    if (error && isActive) {
      toast.error(error.message);
      stop();
    }
  }, [error, isActive, stop]);

  return (
    <div className="w-full h-full flex flex-col bg-card">
      <div
        className="w-full flex p-2 gap-2 items-center border-b"
        style={{
          userSelect: "text",
        }}
      >
        <span className="text-sm font-semibold text-foreground">
          {t("VoiceChat.title")}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Hidden for now - keep for future debugging */}
          {/* <EnabledToolsDropdown align="end" side="bottom" tools={tools} /> */}

          {agent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {agent.name}
                  </span>
                  <div
                    style={agent.icon?.style}
                    className="relative group size-7 items-center justify-center flex rounded-md ring-1 ring-secondary"
                  >
                    <Avatar className="size-6">
                      <AvatarImage
                        src={
                          agent.icon?.value
                            ? getEmojiUrl(agent.icon.value, "apple", 64)
                            : undefined
                        }
                      />
                      <AvatarFallback className="text-xs">
                        {agent.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>

                    <button
                      type="button"
                      className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-destructive text-destructive-foreground border border-background opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        appStoreMutate((prev) => ({
                          voiceChat: {
                            ...prev.voiceChat,
                            agentId: undefined,
                          },
                        }));
                      }}
                      aria-label="Remove agent"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-2 max-w-xs">
                <div className="space-y-2">
                  {(agent.role || agent.description) && (
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {agent.role || agent.description}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 mx-auto w-full relative">
        {error ? (
          <div className="p-4">
            <Alert variant={"destructive"}>
              <TriangleAlertIcon className="size-4 " />
              <AlertTitle className="">Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>

              <AlertDescription className="my-4 ">
                <p className="text-muted-foreground ">
                  {t("VoiceChat.pleaseCloseTheVoiceChatAndTryAgain")}
                </p>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        {isLoading ? (
          <div className="flex-1"></div>
        ) : (
          <div className="h-full w-full">
            {useCompactView ? (
              <CompactMessageView messages={messages} />
            ) : (
              <ConversationView messages={messages} />
            )}
          </div>
        )}
      </div>
      <div className="relative w-full p-4 flex flex-col items-center justify-center gap-4 border-t">
        <div className="w-full relative flex justify-center">
          <div className="text-sm text-muted-foreground flex items-center justify-center min-h-[1.5rem]">
            {statusMessage}
          </div>
        </div>

        <div className="w-full relative flex justify-between items-center">
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={"secondary"}
                    size={"icon"}
                    disabled={isLoading}
                    onClick={() => {
                      if (!isActive) {
                        startWithSound();
                      } else {
                        stopWithSound();
                      }
                    }}
                    className={cn(
                      "rounded-full p-6 transition-colors duration-300",
                      isLoading
                        ? "bg-accent-foreground text-accent animate-pulse"
                        : !isActive
                          ? "bg-green-500/10 text-green-500 hover:bg-green-500/30"
                          : "bg-destructive/30 text-destructive hover:bg-destructive/10",
                    )}
                  >
                    {isLoading ? (
                      <Loader className="size-6 animate-spin" />
                    ) : !isActive ? (
                      <PhoneIcon className="size-6 fill-green-500 stroke-none" />
                    ) : (
                      <PhoneOffIcon className="size-6" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!isActive
                    ? t("VoiceChat.startConversation")
                    : t("VoiceChat.endConversation")}
                </TooltipContent>
              </Tooltip>

              {isActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={"secondary"}
                      size={"icon"}
                      disabled={isLoading}
                      onClick={() => {
                        if (isListening) {
                          stopListening();
                        } else {
                          startListening();
                        }
                      }}
                      className={cn(
                        "rounded-full p-6 transition-colors duration-300",
                        !isListening
                          ? "bg-destructive/30 text-destructive hover:bg-destructive/10"
                          : isUserSpeaking
                            ? "bg-input text-foreground"
                            : "",
                      )}
                    >
                      {isListening ? (
                        <MicIcon
                          className={`size-6 ${isUserSpeaking ? "text-primary" : "text-muted-foreground transition-colors duration-300"}`}
                        />
                      ) : (
                        <MicOffIcon className="size-6" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isListening
                      ? t("VoiceChat.closeMic")
                      : t("VoiceChat.openMic")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={"secondary"}
                  size={"icon"}
                  className="size-8"
                  onClick={() => setUseCompactView(!useCompactView)}
                >
                  {useCompactView ? (
                    <MessageSquareMoreIcon className="size-4" />
                  ) : (
                    <MessagesSquareIcon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {t("VoiceChat.displayMode")}
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={"secondary"}
                      size={"icon"}
                      className="size-8"
                    >
                      <PianoIcon className="text-foreground size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {t("VoiceChat.tune")}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="top" className="min-w-40" align="end">
                {Object.entries(OPENAI_VOICE).map(([key, value]) => (
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between"
                    onClick={() =>
                      appStoreMutate({
                        voiceChat: {
                          ...voiceChat,
                          options: {
                            provider: "openai",
                            providerOptions: {
                              voice: value,
                            },
                          },
                        },
                      })
                    }
                    key={key}
                  >
                    {key}

                    {value === voiceChat.options.providerOptions?.voice && (
                      <CheckIcon className="size-3.5" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationView({
  messages,
}: { messages: UIMessageWithCompleted[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length]);
  return (
    <div className="select-text w-full overflow-y-auto h-full" ref={ref}>
      <div className="flex flex-col px-4 py-4 gap-4 min-h-0 min-w-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex px-3 py-2 text-sm",
              message.role == "user" &&
                "ml-auto max-w-[90%] text-foreground rounded-2xl w-fit bg-input/40",
            )}
          >
            {!message.completed ? (
              <MessageLoading
                className={cn(
                  message.role == "user"
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              />
            ) : (
              message.parts.map((part, index) => {
                if (part.type === "text") {
                  if (!part.text) {
                    return (
                      <MessageLoading
                        key={index}
                        className={cn(
                          message.role == "user"
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      />
                    );
                  }
                  return (
                    <p key={index}>
                      {(part.text || "...")
                        ?.trim()
                        .split(" ")
                        .map((word, wordIndex) => (
                          <span
                            key={wordIndex}
                            className="animate-in fade-in duration-3000"
                          >
                            {word}{" "}
                          </span>
                        ))}
                    </p>
                  );
                } else if (isToolUIPart(part)) {
                  return (
                    <ToolMessagePart
                      key={index}
                      part={part}
                      showActions={false}
                      messageId={message.id}
                      isLast={part.state.startsWith("input")}
                    />
                  );
                }
                return <p key={index}>{part.type} unknown part</p>;
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactMessageView({
  messages,
}: {
  messages: UIMessageWithCompleted[];
}) {
  const { toolParts, textPart } = useMemo(() => {
    const allToolParts = messages
      .filter((msg) => msg.parts.some(isToolUIPart))
      .map((msg) => msg.parts.find(isToolUIPart));

    // In compact mode, only show the latest 6 tools to avoid covering text
    const toolParts = allToolParts.slice(-6);

    const textPart = messages.findLast((msg) => msg.role === "assistant")
      ?.parts[0] as TextPart;
    return { toolParts, textPart };
  }, [messages]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="absolute bottom-4 max-h-[60vh] overflow-y-auto left-4 z-10 flex-col gap-2 hidden md:flex">
        {toolParts.map((toolPart, index) => {
          const isExecuting = toolPart?.state.startsWith("input");
          if (!toolPart) return null;
          return (
            <Dialog key={index}>
              <DialogTrigger asChild>
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-3000 max-w-xs w-full">
                  <Button
                    variant={"outline"}
                    size={"icon"}
                    className="w-full bg-card flex items-center gap-2 px-2 text-xs text-muted-foreground"
                  >
                    <WrenchIcon className="size-3.5" />
                    <span className="text-sm font-bold min-w-0 truncate mr-auto">
                      {getToolName(toolPart)}
                    </span>
                    {isExecuting ? (
                      <Loader className="size-3.5 animate-spin" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </Button>
                </div>
              </DialogTrigger>
              <DialogContent className="z-50 md:max-w-2xl! max-h-[80vh] overflow-y-auto p-8">
                <DialogTitle>{getToolName(toolPart)}</DialogTitle>
                <div className="flex flex-row gap-4 text-sm ">
                  <div className="w-1/2 min-w-0 flex flex-col">
                    <div className="flex items-center gap-2 mb-2 pt-2 pb-1 z-10">
                      <h5 className="text-muted-foreground text-sm font-medium">
                        Inputs
                      </h5>
                    </div>
                    <JsonView data={toolPart.input} />
                  </div>

                  <div className="w-1/2 min-w-0 pl-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 pt-2 pb-1  z-10">
                      <h5 className="text-muted-foreground text-sm font-medium">
                        Outputs
                      </h5>
                    </div>
                    <JsonView
                      data={
                        toolPart.state === "output-available"
                          ? toolPart.output
                          : toolPart.state == "output-error"
                            ? toolPart.errorText
                            : {}
                      }
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>

      {/* Current Message - Prominent */}
      {textPart && (
        <div className="w-full mx-auto h-full max-h-[80vh] overflow-y-auto px-4 flex-1 flex items-center justify-center text-center">
          <div className="animate-in fade-in-50 duration-1000">
            <p className="text-xl md:text-2xl font-semibold leading-tight tracking-wide">
              {textPart.text?.split(" ").map((word, wordIndex) => (
                <span
                  key={wordIndex}
                  className="animate-in fade-in duration-5000"
                >
                  {word}{" "}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
