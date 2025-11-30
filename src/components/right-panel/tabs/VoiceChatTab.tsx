"use client";

import { getToolName, isToolUIPart, TextPart } from "ai";
import { DEFAULT_VOICE_TOOLS, UIMessageWithCompleted } from "lib/ai/speech";

import {
  OPENAI_VOICE,
  useOpenAIVoiceChat as OpenAIVoiceChat,
} from "lib/ai/speech/open-ai/use-voice-chat.openai";
import { cn, groupBy } from "lib/utils";
import {
  CheckIcon,
  Loader,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  Settings2Icon,
  TriangleAlertIcon,
  MessagesSquareIcon,
  MessageSquareMoreIcon,
  WrenchIcon,
  ChevronRight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { Button } from "ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { GeminiIcon } from "ui/gemini-icon";
import { MessageLoading } from "ui/message-loading";
import { OpenAIIcon } from "ui/openai-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { ToolMessagePart } from "@/components/message-parts";

import {
  EnabledTools,
  EnabledToolsDropdown,
} from "@/components/enabled-tools-dropdown";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "ui/dialog";
import JsonView from "ui/json-view";
import { useAgent } from "@/hooks/queries/use-agent";
import { ChatMention } from "app-types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { getEmojiUrl } from "lib/emoji";

const prependTools: EnabledTools[] = [
  {
    groupName: "Browser",
    tools: DEFAULT_VOICE_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
    })),
  },
];

export function VoiceTab() {
  const t = useTranslations("Chat");
  const [agentId, appStoreMutate, voiceChat, allowedMcpServers, mcpList] =
    appStore(
      useShallow((state) => [
        state.voiceChat.agentId,
        state.mutate,
        state.voiceChat,
        state.allowedMcpServers,
        state.mcpList,
      ]),
    );

  const { agent } = useAgent(agentId);

  const startAudio = useRef<HTMLAudioElement>(null);
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

  const startWithSound = useCallback(() => {
    if (!startAudio.current) {
      startAudio.current = new Audio("/sounds/start_voice.ogg");
    }
    start().then(() => {
      startAudio.current?.play().catch(() => {});
    });
  }, [start]);

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

  const mcpTools = useMemo<EnabledTools[]>(() => {
    const mcpMentions = toolMentions.filter(
      (v) => v.type === "mcpTool",
    ) as Extract<ChatMention, { type: "mcpTool" }>[];

    const groupByServer = groupBy(mcpMentions, "serverName");
    return Object.entries(groupByServer).map(([serverName, tools]) => {
      return {
        groupName: serverName,
        tools: tools.map((v) => ({
          name: v.name,
          description: v.description,
        })),
      };
    });
  }, [toolMentions]);

  const tools = useMemo<EnabledTools[]>(() => {
    return [...prependTools, ...mcpTools];
  }, [mcpTools]);

  useEffect(() => {
    if (error && isActive) {
      toast.error(error.message);
      stop();
    }
  }, [error, isActive, stop]);

  return (
    <div className="w-full h-full flex flex-col bg-card">
      <div
        className="w-full flex p-4 gap-2 items-center border-b"
        style={{
          userSelect: "text",
        }}
      >
        {agent && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                style={agent.icon?.style}
                className="size-8 items-center justify-center flex rounded-lg ring ring-secondary"
              >
                <Avatar className="size-5">
                  <AvatarImage
                    src={
                      agent.icon?.value
                        ? getEmojiUrl(agent.icon.value, "apple", 64)
                        : undefined
                    }
                  />
                  <AvatarFallback>{agent.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-3 max-w-xs">
              <div className="space-y-2">
                <div className="font-semibold text-sm">{agent.name}</div>
                {agent.description && (
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {agent.description}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
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
          <TooltipContent>
            {useCompactView
              ? t("VoiceChat.compactDisplayMode")
              : t("VoiceChat.conversationDisplayMode")}
          </TooltipContent>
        </Tooltip>

        <EnabledToolsDropdown align="start" side="bottom" tools={tools} />

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={"ghost"} size={"icon"} className="size-8">
                <Settings2Icon className="text-foreground size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" className="min-w-40" align="start">
              <DropdownMenuGroup className="cursor-pointer">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    className="flex items-center gap-2 cursor-pointer"
                    icon=""
                  >
                    <OpenAIIcon className="size-3.5 stroke-none fill-foreground" />
                    Open AI
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
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

                          {value ===
                            voiceChat.options.providerOptions?.voice && (
                            <CheckIcon className="size-3.5" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      className="flex items-center gap-2 text-muted-foreground"
                      icon=""
                    >
                      <GeminiIcon className="size-3.5" />
                      Gemini
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <div className="text-xs text-muted-foreground p-6">
                          Not Implemented Yet
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <div className="text-sm text-muted-foreground w-full justify-center flex items-center min-h-[1.5rem]">
          {statusMessage}
        </div>

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
                  } else if (isListening) {
                    stopListening();
                  } else {
                    startListening();
                  }
                }}
                className={cn(
                  "rounded-full p-6 transition-colors duration-300",

                  isLoading
                    ? "bg-accent-foreground text-accent animate-pulse"
                    : !isActive
                      ? "bg-green-500/10 text-green-500 hover:bg-green-500/30"
                      : !isListening
                        ? "bg-destructive/30 text-destructive hover:bg-destructive/10"
                        : isUserSpeaking
                          ? "bg-input text-foreground"
                          : "",
                )}
              >
                {isLoading ? (
                  <Loader className="size-6 animate-spin" />
                ) : !isActive ? (
                  <PhoneIcon className="size-6 fill-green-500 stroke-none" />
                ) : isListening ? (
                  <MicIcon
                    className={`size-6 ${isUserSpeaking ? "text-primary" : "text-muted-foreground transition-colors duration-300"}`}
                  />
                ) : (
                  <MicOffIcon className="size-6" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {!isActive
                ? t("VoiceChat.startConversation")
                : isListening
                  ? t("VoiceChat.closeMic")
                  : t("VoiceChat.openMic")}
            </TooltipContent>
          </Tooltip>
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
    const toolParts = messages
      .filter((msg) => msg.parts.some(isToolUIPart))
      .map((msg) => msg.parts.find(isToolUIPart));

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
