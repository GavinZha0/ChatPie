"use client";

import {
  AudioWaveformIcon,
  CornerRightUp,
  FileIcon,
  FileTextIcon,
  ImagesIcon,
  Loader2,
  PaperclipIcon,
  PlusIcon,
  Square,
  XIcon,
  Users,
  Repeat1,
  Target,
  Check,
  Scale,
  MessagesSquare,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "ui/button";
import { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import { SelectModel } from "./select-model";
import { appStore, UploadedFile, type ChatWidthMode } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ChatMention, ChatModel } from "app-types/chat";
import dynamic from "next/dynamic";

import { ToolSelectDropdown } from "./tool-select-dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { useTranslations } from "next-intl";
import { Editor } from "@tiptap/react";
import { WorkflowSummary } from "app-types/workflow";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import equal from "lib/equal";
import { MCPIcon } from "ui/mcp-icon";
import { DefaultToolName } from "lib/ai/tools";
import { DefaultToolIcon } from "./default-tool-icon";
import { OpenAIIcon } from "ui/openai-icon";
import { GeminiIcon } from "ui/gemini-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useThreadFileUploader } from "@/hooks/use-thread-file-uploader";

import { useAgents } from "@/hooks/queries/use-agents";
import { FileUIPart, TextUIPart } from "ai";
import { toast } from "sonner";
import { isFilePartSupported, isIngestSupported } from "@/lib/ai/file-support";
import { useChatModels } from "@/hooks/queries/use-chat-models";
import { WriteIcon } from "ui/write-icon";
import { EMOJI_DATA } from "lib/const";
import { getEmojiUrl } from "lib/emoji";

interface PromptInputProps {
  placeholder?: string;
  setInput: (value: string) => void;
  input: string;
  onStop: () => void;
  sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
  toolDisabled?: boolean;
  isLoading?: boolean;
  model?: ChatModel;
  setModel?: (model: ChatModel) => void;
  voiceDisabled?: boolean;
  threadId?: string;
  disabledMention?: boolean;
  onFocus?: () => void;
  widthMode?: ChatWidthMode;
  onNewChat?: () => void;
  onTemporaryReset?: () => void;
  temporaryResetLabel?: string;
  updateGlobalModel?: boolean;
}

const ChatMentionInput = dynamic(() => import("./chat-mention-input"), {
  ssr: false,
  loading() {
    return <div className="h-[2rem] w-full animate-pulse"></div>;
  },
});

export default function PromptInput({
  placeholder,
  sendMessage,
  model,
  setModel,
  input,
  onFocus,
  setInput,
  onStop,
  isLoading,
  toolDisabled,
  voiceDisabled,
  threadId,
  disabledMention,
  widthMode = "centered",
  onNewChat,
  onTemporaryReset,
  temporaryResetLabel,
  updateGlobalModel = true,
}: PromptInputProps) {
  const t = useTranslations("Chat");
  const layoutT = useTranslations("");
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const [isGroupChatModeOpen, setIsGroupChatModeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles } = useThreadFileUploader(threadId);
  const { data: providers } = useChatModels();
  const { agents } = useAgents({ limit: 50 });

  const [
    globalModel,
    threadMentions,
    threadFiles,
    threadImageToolModel,
    groupChatMode,
    appStoreMutate,
  ] = appStore(
    useShallow((state) => [
      state.chatModel,
      state.threadMentions,
      state.threadFiles,
      state.threadImageToolModel,
      state.groupChatMode,
      state.mutate,
    ]),
  );

  const modelInfo = useMemo(() => {
    const provider = providers?.find(
      (provider) => provider.provider === globalModel?.provider,
    );
    const model = provider?.models.find(
      (model) => model.name === globalModel?.model,
    );
    return model;
  }, [providers, globalModel]);

  const supportedFileMimeTypes = modelInfo?.supportedFileMimeTypes;
  const canUploadImages =
    supportedFileMimeTypes?.some((mime) => mime.startsWith("image/")) ?? true;

  const mentions = useMemo<ChatMention[]>(() => {
    if (!threadId) return [];
    return threadMentions[threadId!] ?? [];
  }, [threadMentions, threadId]);

  // Check if there are multiple agents for group chat mode
  const agentMentions = useMemo(() => {
    return mentions.filter((m) => m.type === "agent");
  }, [mentions]);

  const hasMultipleAgents = agentMentions.length > 1;
  const isGroupChatModeEnabled = hasMultipleAgents;

  // Dynamic icon based on selected group chat mode
  const groupChatModeIcon = useMemo(() => {
    switch (groupChatMode) {
      case "comparison":
        return <Users className="size-4" />;
      case "discussion":
        return <MessagesSquare className="size-4" />;
      case "chain":
        return <Repeat1 className="size-4" />;
      case "task":
        return <Target className="size-4" />;
      case "debate":
        return <Scale className="size-4" />;
      default:
        return <Users className="size-4" />;
    }
  }, [groupChatMode]);

  // Determine selected agent and its predefined chat model (if any)
  // Use the LAST agent mentioned (most recently added) as the active one
  const selectedAgentId = useMemo(() => {
    const agentMentions = mentions.filter((m) => m.type === "agent");
    // Return the last agent's ID (most recently added)
    return agentMentions.length > 0
      ? agentMentions[agentMentions.length - 1]?.agentId
      : undefined;
  }, [mentions]);

  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return undefined;
    return agents.find((a) => a.id === selectedAgentId);
  }, [agents, selectedAgentId]);

  const agentPreferredModel = selectedAgent?.model;

  // Sync agent preferred model into global chatModel when agent changes,
  // unless user has manually overridden model for this agent/thread.
  useEffect(() => {
    const isAgentMentioned = mentions.some((m) => m.type === "agent");
    if (!isAgentMentioned) return;
    if (!agentPreferredModel || !threadId) return;
    appStoreMutate((prev) => {
      const manualMap = (prev as any)._agentManualModelByThread || {};
      const manualOverride = manualMap[threadId];
      if (manualOverride) {
        // Honor manual override; ensure previous model captured if not yet
        const prevByThread = (prev as any)._previousModelByThread || {};
        const previousCaptured = prevByThread[threadId] !== undefined;
        const next: any = {
          chatModel: manualOverride,
          _agentManualModelByThread: manualMap,
          _previousModelByThread: { ...prevByThread },
        };
        if (!previousCaptured) {
          next._previousModelByThread[threadId] = prev.chatModel;
        }
        return next;
      }
      // No manual override -> apply agent preferred if different
      const isDifferent =
        globalModel?.provider !== agentPreferredModel.provider ||
        globalModel?.model !== agentPreferredModel.model;
      if (!isDifferent) return prev;
      const prevByThread = (prev as any)._previousModelByThread || {};
      const previousCaptured = prevByThread[threadId] !== undefined;
      const next: any = {
        chatModel: agentPreferredModel,
        _previousModelByThread: { ...prevByThread },
      };
      if (!previousCaptured) {
        next._previousModelByThread[threadId] = prev.chatModel;
      }
      return next;
    });
  }, [agentPreferredModel, globalModel, appStoreMutate, mentions, threadId]);

  const uploadedFiles = useMemo<UploadedFile[]>(() => {
    if (!threadId) return [];
    return threadFiles[threadId] ?? [];
  }, [threadFiles, threadId]);

  const imageToolModel = useMemo(() => {
    if (!threadId) return undefined;
    return threadImageToolModel[threadId];
  }, [threadImageToolModel, threadId]);

  const chatModel = useMemo(() => {
    // Priority: agent predefined model > local model prop > global model
    return agentPreferredModel ?? model ?? globalModel;
  }, [agentPreferredModel, model, globalModel]);

  // Calculate if model selector should be disabled
  const { data: allProviders } = useChatModels();
  const isModelSelectorDisabled = useMemo(() => {
    // Disable when multiple agents are selected (group chat)
    if (hasMultipleAgents) return true;
    if (!agentPreferredModel || !allProviders) return false;
    // Find the agent's model in the provider list to check its type
    for (const provider of allProviders) {
      const agentModel = provider.models.find(
        (m) =>
          m.name === agentPreferredModel.model &&
          provider.provider === agentPreferredModel.provider,
      );
      if (agentModel && agentModel.type === "agent") {
        return true;
      }
    }
    return false;
  }, [hasMultipleAgents, agentPreferredModel, allProviders]);

  const editorRef = useRef<Editor | null>(null);
  const mentionsContainerRef = useRef<HTMLDivElement | null>(null);
  const [showMentionText, setShowMentionText] = useState(true);

  useEffect(() => {
    const recalc = () => {
      const el = mentionsContainerRef.current;
      if (!el) {
        setShowMentionText(true);
        return;
      }
      const containerWidth = el.clientWidth || 0;
      const gap = 8;
      const itemMinWidth = 100;
      const requiredWidth =
        mentions.length * itemMinWidth + Math.max(0, mentions.length - 1) * gap;
      setShowMentionText(containerWidth >= requiredWidth);
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [mentions]);

  // Allow user to override model when an agent is active (per thread)
  const handleSelectModel = useCallback(
    (model: ChatModel) => {
      if (setModel) {
        setModel(model);
      }
      if (updateGlobalModel) {
        appStoreMutate((prev) => {
          const next: any = { chatModel: model };
          if (threadId) {
            const hadAgent = (prev.threadMentions[threadId] || []).some(
              (m) => m.type === "agent",
            );
            if (hadAgent) {
              const manualMap = (prev as any)._agentManualModelByThread || {};
              next._agentManualModelByThread = {
                ...manualMap,
                [threadId]: model,
              };
            }
          }
          return next;
        });
      }
    },
    [setModel, appStoreMutate, threadId, updateGlobalModel],
  );

  const deleteMention = useCallback(
    (mention: ChatMention) => {
      if (!threadId) return;
      appStoreMutate((prev) => {
        const newMentions = mentions.filter((m) => !equal(m, mention));
        const next: any = {
          threadMentions: {
            ...prev.threadMentions,
            [threadId!]: newMentions,
          },
        };
        if (mention.type === "agent") {
          const prevByThread = (prev as any)._previousModelByThread || {};
          const previousModel = prevByThread[threadId];
          // Revert to previous model if captured; and clear the capture for this thread
          next.chatModel = previousModel;
          next._previousModelByThread = { ...prevByThread };
          delete next._previousModelByThread[threadId];
        }
        return next;
      });
    },
    [mentions, threadId, appStoreMutate],
  );

  const deleteFile = useCallback(
    (fileId: string) => {
      if (!threadId) return;

      // Find file and abort if uploading
      const file = uploadedFiles.find((f) => f.id === fileId);
      if (file?.isUploading && file.abortController) {
        file.abortController.abort();
      }

      // Cleanup preview URL if exists
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }

      appStoreMutate((prev) => {
        const newFiles = uploadedFiles.filter((f) => f.id !== fileId);
        return {
          threadFiles: {
            ...prev.threadFiles,
            [threadId]: newFiles,
          },
        };
      });
    },
    [uploadedFiles, threadId, appStoreMutate],
  );

  // uploadFiles handled by hook

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list) return;
      await uploadFiles(Array.from(list));
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsUploadDropdownOpen(false);
    },
    [uploadFiles],
  );

  const handleGenerateImage = useCallback(
    (provider?: "google" | "openai") => {
      if (!provider) {
        appStoreMutate({
          threadImageToolModel: {},
        });
      }
      if (!threadId) return;

      setIsUploadDropdownOpen(false);

      appStoreMutate((prev) => ({
        threadImageToolModel: {
          ...prev.threadImageToolModel,
          [threadId]: provider,
        },
      }));

      // Focus on the input
      editorRef.current?.commands.focus();
    },
    [threadId, editorRef],
  );

  const addMention = useCallback(
    (mention: ChatMention) => {
      if (!threadId) return;
      appStoreMutate((prev) => {
        if (mentions.some((m) => equal(m, mention))) return prev;

        // Allow multiple agents for multi-agent support
        const newMentions = [...mentions, mention];

        return {
          threadMentions: {
            ...prev.threadMentions,
            [threadId!]: newMentions,
          },
        };
      });
    },
    [mentions, threadId],
  );

  const onSelectWorkflow = useCallback(
    (workflow: WorkflowSummary) => {
      addMention({
        type: "workflow",
        name: workflow.name,
        icon: workflow.icon,
        workflowId: workflow.id,
        description: workflow.description,
      });
    },
    [addMention],
  );

  const onChangeMention = useCallback(
    (mentions: ChatMention[]) => {
      // Allow multiple agents for future multi-agent support
      mentions.forEach(addMention);
    },
    [addMention],
  );

  const submit = () => {
    if (isLoading) return;
    if (uploadedFiles.some((file) => file.isUploading)) {
      toast.error("Please wait for files to finish uploading before sending.");
      return;
    }
    const userMessage = (() => {
      try {
        const json = editorRef.current?.getJSON() as any;
        const lines: string[] = [];
        for (const block of json?.content || []) {
          let line = "";
          const content = (block as any)?.content || [];
          for (const node of content) {
            if (node?.type === "text") {
              line += node.text || "";
            } else if (node?.type === "hardBreak") {
              lines.push(line);
              line = "";
            }
            // Ignore mention nodes entirely for Scheme A
          }
          lines.push(line);
        }
        return lines.join("\n").trim();
      } catch {
        return input?.trim() || "";
      }
    })();
    if (userMessage.length === 0) return;

    setInput("");
    const attachmentParts = uploadedFiles.reduce<
      Array<FileUIPart | TextUIPart | any>
    >((acc, file) => {
      const isFileSupported = isFilePartSupported(
        file.mimeType,
        supportedFileMimeTypes,
      );
      const link = file.url || file.dataUrl || "";
      if (!link) return acc;
      if (isFileSupported) {
        acc.push({
          type: "file",
          url: link,
          mediaType: file.mimeType,
          filename: file.name,
        } as FileUIPart);
      } else {
        // Use a rich UI part for unsupported file types; will be filtered out for model input
        acc.push({
          type: "source-url",
          url: link,
          title: file.name,
          mediaType: file.mimeType,
        } as any);
      }
      return acc;
    }, []);

    if (attachmentParts.length) {
      const summary = uploadedFiles
        .map((file, index) => {
          const type = file.mimeType || "unknown";
          return `${index + 1}. ${file.name} (${type})`;
        })
        .join("\n");

      attachmentParts.unshift({
        type: "text",
        text: `Attached files:\n${summary}`,
        ingestionPreview: true,
      });
    }

    sendMessage({
      role: "user",
      parts: [...attachmentParts, { type: "text", text: userMessage }],
    });
    appStoreMutate((prev) => ({
      threadFiles: {
        ...prev.threadFiles,
        [threadId!]: [],
      },
    }));
  };

  // Handle ESC key to clear mentions (and revert model if agent was active)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        threadId &&
        (mentions.length > 0 || imageToolModel)
      ) {
        e.preventDefault();
        e.stopPropagation();
        appStoreMutate((prev) => {
          const prevByThread = (prev as any)._previousModelByThread || {};
          const previousModel = prevByThread[threadId!];
          const hadAgent = (prev.threadMentions[threadId!] || []).some(
            (m) => m.type === "agent",
          );
          const next: any = {
            // Only clear mentions for current thread
            threadMentions: {
              ...prev.threadMentions,
              [threadId!]: [],
            },
            // Clear image tool model for current thread
            threadImageToolModel: {
              ...prev.threadImageToolModel,
              [threadId!]: undefined,
            },
            agentId: undefined,
          };
          if (hadAgent) {
            next.chatModel = previousModel;
            next._previousModelByThread = { ...prevByThread };
            delete next._previousModelByThread[threadId!];
          }
          return next;
        });
        editorRef.current?.commands.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mentions.length, threadId, appStoreMutate, imageToolModel, editorRef]);

  // Drag overlay handled globally in ChatBot

  return (
    <div
      className={cn(
        "fade-in animate-in w-full",
        widthMode === "wide" ? "px-10" : "max-w-4xl mx-auto",
      )}
    >
      <div
        className={cn(
          "z-10 mx-auto w-full relative",
          widthMode === "wide" ? "max-w-none" : "max-w-4xl",
        )}
      >
        <div className="flex w-full items-end gap-2">
          <fieldset className="flex flex-1 min-w-0 max-w-full flex-col px-4">
            <div className="shadow-lg overflow-hidden rounded-4xl backdrop-blur-sm transition-all duration-200 bg-muted/60 relative flex w-full flex-col cursor-text z-10 items-stretch focus-within:bg-muted hover:bg-muted focus-within:ring-muted hover:ring-muted">
              {mentions.length > 0 ? (
                <div className="bg-input rounded-b-sm rounded-t-3xl p-1 mx-2 my-1">
                  <div
                    ref={mentionsContainerRef}
                    className="flex w-full flex-row gap-1 items-center flex-nowrap overflow-hidden"
                  >
                    {mentions.map((mention, i) => {
                      const showText = showMentionText;

                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "group relative flex items-center gap-2 rounded-full transition-all",
                                showText
                                  ? "min-w-[100px] px-3 py-1.5"
                                  : "size-9 justify-center",
                                "bg-background hover:bg-accent cursor-default",
                              )}
                            >
                              {mention.type === "workflow" ||
                              mention.type === "agent" ? (
                                <Avatar
                                  className={cn(
                                    "ring ring-border rounded-full flex-shrink-0",
                                    "size-6 p-0.5",
                                  )}
                                  style={mention.icon?.style}
                                >
                                  <AvatarImage
                                    src={
                                      mention.icon?.value
                                        ? getEmojiUrl(
                                            mention.icon.value,
                                            "apple",
                                            64,
                                          )
                                        : getEmojiUrl(
                                            EMOJI_DATA[i % EMOJI_DATA.length],
                                            "apple",
                                            64,
                                          )
                                    }
                                  />
                                  <AvatarFallback>
                                    {mention.name.slice(0, 1)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <Button
                                  className={cn(
                                    "flex items-center justify-center ring ring-border rounded-full flex-shrink-0 p-0.5",
                                    showText ? "size-6" : "size-7",
                                  )}
                                >
                                  {mention.type == "mcpServer" ? (
                                    <MCPIcon
                                      className={
                                        showText ? "size-3.5" : "size-4"
                                      }
                                    />
                                  ) : (
                                    <DefaultToolIcon
                                      name={mention.name as DefaultToolName}
                                      className={
                                        showText ? "size-3.5" : "size-4"
                                      }
                                    />
                                  )}
                                </Button>
                              )}

                              {/* Show text only when <=3 items */}
                              {showText && (
                                <span className="text-sm font-semibold truncate flex-1 min-w-0">
                                  {mention.name}
                                </span>
                              )}

                              {/* X button - show on hover */}
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!threadId}
                                className={cn(
                                  "rounded-full flex-shrink-0 transition-opacity",
                                  showText
                                    ? "size-5 opacity-0 group-hover:opacity-100"
                                    : "absolute -top-1 -right-1 size-5 opacity-0 group-hover:opacity-100 bg-background hover:bg-destructive hover:text-destructive-foreground shadow-sm",
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMention(mention);
                                }}
                              >
                                <XIcon className="size-3" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center">
                            <span className="text-sm font-semibold">
                              {mention.name}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-3.5 px-5 pt-2 pb-4">
                <div className="relative min-h-[2rem]">
                  <ChatMentionInput
                    input={input}
                    onChange={setInput}
                    onChangeMention={onChangeMention}
                    onEnter={submit}
                    placeholder={placeholder ?? t("chatPlaceholder")}
                    ref={editorRef}
                    disabledMention={disabledMention}
                    onFocus={onFocus}
                  />
                </div>
                <div className="flex w-full items-center z-30">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.tar,.gz,.mp3,.wav,.m4a,.ogg,.mp4,.webm,.mov"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={!threadId}
                  />

                  {onNewChat ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size={"sm"}
                          onClick={onNewChat}
                          aria-label={layoutT("Layout.newChat")}
                          className="rounded-full p-2!"
                        >
                          <WriteIcon className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="center">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold">
                            {layoutT("Layout.newChat")}
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}

                  {onTemporaryReset ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size={"sm"}
                          onClick={onTemporaryReset}
                          aria-label={
                            temporaryResetLabel ?? t("TemporaryChat.resetChat")
                          }
                          className={cn(
                            "rounded-full p-2!",
                            onNewChat ? "ml-2" : undefined,
                          )}
                        >
                          <WriteIcon className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="center">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold">
                            {temporaryResetLabel ??
                              t("TemporaryChat.resetChat")}
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}

                  <DropdownMenu
                    open={isUploadDropdownOpen}
                    onOpenChange={setIsUploadDropdownOpen}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant={"ghost"}
                            size={"sm"}
                            className="rounded-full hover:bg-input! p-2! data-[state=open]:bg-input! ml-2"
                            disabled={!threadId}
                          >
                            <PlusIcon />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="center">
                        <span className="text-sm">{t("uploadImage")}</span>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="start" side="top">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={
                          modelInfo?.isImageInputUnsupported || !canUploadImages
                        }
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <PaperclipIcon className="mr-2 size-4" />
                        {t("uploadImage")}
                      </DropdownMenuItem>

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <ImagesIcon className="mr-4 size-4 text-muted-foreground" />
                          <span className="mr-4">{t("generateImage")}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              disabled={modelInfo?.isToolCallUnsupported}
                              onClick={() => handleGenerateImage("google")}
                              className="cursor-pointer"
                            >
                              <GeminiIcon className="mr-2 size-4" />
                              Gemini (Nano Banana)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={modelInfo?.isToolCallUnsupported}
                              onClick={() => handleGenerateImage("openai")}
                              className="cursor-pointer"
                            >
                              <OpenAIIcon className="mr-2 size-4" />
                              OpenAI
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {!toolDisabled &&
                    (imageToolModel ? (
                      <Button
                        variant={"ghost"}
                        size={"sm"}
                        className="rounded-full hover:bg-input! p-2! group/image-generator text-primary"
                        onClick={() => handleGenerateImage()}
                      >
                        <ImagesIcon className="size-3.5" />
                        {t("generateImage")}
                        <XIcon className="size-3 group-hover/image-generator:opacity-100 opacity-0 transition-opacity duration-200" />
                      </Button>
                    ) : (
                      <ToolSelectDropdown
                        className="mx-1"
                        align="start"
                        side="top"
                        onSelectWorkflow={onSelectWorkflow}
                        onGenerateImage={handleGenerateImage}
                        mentions={mentions}
                      />
                    ))}
                  {/* Group Chat Mode Selector */}
                  {!disabledMention && (
                    <DropdownMenu
                      open={isGroupChatModeOpen}
                      onOpenChange={setIsGroupChatModeOpen}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full hover:bg-input! p-2! data-[state=open]:bg-input! mx-1"
                              disabled={!isGroupChatModeEnabled}
                            >
                              {groupChatModeIcon}
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="center">
                          <span className="text-sm">
                            {t("GroupChat.teamMode")}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent
                        align="start"
                        side="top"
                        className="w-64"
                      >
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => {
                            appStoreMutate({ groupChatMode: "comparison" });
                            setIsGroupChatModeOpen(false);
                          }}
                        >
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-2">
                              <Users className="size-4" />
                              <span className="font-bold">
                                {t("GroupChat.comparison")}
                              </span>
                              {groupChatMode === "comparison" && (
                                <Check className="ml-auto size-4" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("GroupChat.comparisonDescription")}
                            </p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => {
                            appStoreMutate({ groupChatMode: "discussion" });
                            setIsGroupChatModeOpen(false);
                          }}
                        >
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-2">
                              <MessagesSquare className="size-4" />
                              <span className="font-bold">
                                {t("GroupChat.discussion")}
                              </span>
                              {groupChatMode === "discussion" && (
                                <Check className="ml-auto size-4" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("GroupChat.discussionDescription")}
                            </p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => {
                            appStoreMutate({ groupChatMode: "chain" });
                            setIsGroupChatModeOpen(false);
                          }}
                        >
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-2">
                              <Repeat1 className="size-4" />
                              <span className="font-bold">
                                {t("GroupChat.chain")}
                              </span>
                              {groupChatMode === "chain" && (
                                <Check className="ml-auto size-4" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("GroupChat.chainDescription")}
                            </p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => {
                            appStoreMutate({ groupChatMode: "task" });
                            setIsGroupChatModeOpen(false);
                          }}
                        >
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-2">
                              <Target className="size-4" />
                              <span className="font-bold">
                                {t("GroupChat.task")}
                              </span>
                              {groupChatMode === "task" && (
                                <Check className="ml-auto size-4" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("GroupChat.taskDescription")}
                            </p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => {
                            appStoreMutate({ groupChatMode: "debate" });
                            setIsGroupChatModeOpen(false);
                          }}
                        >
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-2">
                              <Scale className="size-4" />
                              <span className="font-bold">
                                {t("GroupChat.debate")}
                              </span>
                              {groupChatMode === "debate" && (
                                <Check className="ml-auto size-4" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("GroupChat.debateDescription")}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <div className="flex-1" />

                  {!hasMultipleAgents && (
                    <SelectModel
                      modelTypes={["chat"]}
                      onSelect={handleSelectModel}
                      currentModel={chatModel}
                      disabled={isModelSelectorDisabled}
                    />
                  )}
                  {!isLoading && !input.length && !voiceDisabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size={"sm"}
                          onClick={() => {
                            appStoreMutate((state) => ({
                              voiceChat: {
                                ...state.voiceChat,
                                isOpen: true,
                                agentId: undefined,
                              },
                            }));
                          }}
                          className="rounded-full p-2!"
                        >
                          <AudioWaveformIcon size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("VoiceChat.title")}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <div
                      onClick={() => {
                        if (isLoading) {
                          onStop();
                        } else {
                          submit();
                        }
                      }}
                      className="fade-in animate-in cursor-pointer text-muted-foreground rounded-full p-2 bg-secondary hover:bg-accent-foreground hover:text-accent transition-all duration-200"
                    >
                      {isLoading ? (
                        <Square
                          size={16}
                          className="fill-muted-foreground text-muted-foreground"
                        />
                      ) : (
                        <CornerRightUp size={16} />
                      )}
                    </div>
                  )}
                </div>

                {/* Uploaded Files Preview - Below Input */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file) => {
                      const isImage = file.mimeType.startsWith("image/");
                      const imageSrc =
                        file.previewUrl || file.url || file.dataUrl || "";
                      const displayName = file.name;
                      const displayExt =
                        file.name.split(".").pop()?.toUpperCase() || "FILE";
                      const isSummarizable = isIngestSupported(file.mimeType);
                      return (
                        <div
                          key={file.id}
                          className="relative group rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all"
                        >
                          {isImage ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={imageSrc}
                              alt={file.name}
                              className="w-24 h-24 object-cover"
                            />
                          ) : (
                            <div className="w-32 h-28 flex flex-col items-center justify-center bg-muted px-2 py-3 text-center">
                              <FileIcon className="size-8 text-muted-foreground mb-1" />
                              <span className="text-xs font-medium text-muted-foreground line-clamp-2 w-full">
                                {displayName}
                              </span>
                              <span className="text-[11px] text-muted-foreground/80">
                                {displayExt}
                              </span>
                            </div>
                          )}

                          {/* Upload Progress Overlay */}
                          {file.isUploading && (
                            <div className="absolute inset-0 bg-background/90 flex rounded-lg flex-col items-center justify-center backdrop-blur-sm">
                              <Loader2 className="size-6 animate-spin text-foreground mb-2" />
                              <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${file.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-foreground text-xs mt-1">
                                {file.progress || 0}%
                              </span>
                            </div>
                          )}

                          {/* Hover Actions */}
                          <div
                            className={cn(
                              "absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity flex items-center justify-center rounded-lg",
                              file.isUploading
                                ? "opacity-0"
                                : "opacity-0 group-hover:opacity-100",
                            )}
                          >
                            <div className="flex gap-2 items-center">
                              {isSummarizable && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="icon"
                                      className="rounded-full"
                                      onClick={async () => {
                                        try {
                                          const url = file.url || file.dataUrl;
                                          if (!url) {
                                            toast.error(
                                              "No file URL available",
                                            );
                                            return;
                                          }
                                          const res = await fetch(
                                            "/api/storage/ingest",
                                            {
                                              method: "POST",
                                              headers: {
                                                "Content-Type":
                                                  "application/json",
                                              },
                                              body: JSON.stringify({ url }),
                                            },
                                          );
                                          if (!res.ok) {
                                            const e = await res
                                              .json()
                                              .catch(() => ({}));
                                            toast.error(
                                              e.error ||
                                                "Failed to ingest file",
                                            );
                                            return;
                                          }
                                          const data = await res.json();
                                          // Append preview text to input for the user to send
                                          setInput(
                                            `${input ? input + "\n\n" : ""}${data.text}`,
                                          );
                                        } catch (_err) {
                                          toast.error("Failed to ingest file");
                                        }
                                      }}
                                    >
                                      <FileTextIcon className="size-4" />
                                      <span className="sr-only">Summarize</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Summarize</TooltipContent>
                                </Tooltip>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full bg-background/80 hover:bg-background"
                                onClick={() => deleteFile(file.id)}
                                disabled={file.isUploading}
                              >
                                <XIcon className="size-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Cancel Upload Button (Top Right) */}
                          {file.isUploading && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 size-6 rounded-full bg-background/60 hover:bg-background/80 backdrop-blur-sm"
                              onClick={() => deleteFile(file.id)}
                            >
                              <XIcon className="size-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
