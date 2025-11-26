"use client";

import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PromptInput from "./prompt-input";
import clsx from "clsx";
import { appStore } from "@/app/store";
import { cn, createDebounce, generateUUID, truncateString } from "lib/utils";
import { ErrorMessage, PreviewMessage } from "./message";
import { ChatGreeting } from "./chat-greeting";

import { useShallow } from "zustand/shallow";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  TextUIPart,
  UIMessage,
} from "ai";

import { safe } from "ts-safe";
import { mutate } from "swr";
import {
  ChatApiSchemaRequestBody,
  ChatAttachment,
  ChatModel,
  MyUIMessage,
  ChatMetadata,
} from "app-types/chat";
import { useToRef } from "@/hooks/use-latest";
import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import { Button } from "ui/button";
import { deleteThreadAction } from "@/app/api/chat/actions";
import { useRouter } from "next/navigation";
import { ArrowDown, Loader, FilePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { useTranslations } from "next-intl";
import { Think } from "ui/think";
import { useGenerateThreadTitle } from "@/hooks/queries/use-generate-thread-title";
import dynamic from "next/dynamic";
import { useMounted } from "@/hooks/use-mounted";
import { getStorageManager } from "lib/browser-stroage";
import { AnimatePresence, motion } from "framer-motion";
import { useThreadFileUploader } from "@/hooks/use-thread-file-uploader";
import { useFileDragOverlay } from "@/hooks/use-file-drag-overlay";
import { useAgents } from "@/hooks/queries/use-agents";
import { useChatModels } from "@/hooks/queries/use-chat-models";
import { authClient } from "auth/client";

type Props = {
  threadId: string;
  initialMessages: Array<MyUIMessage>;
  selectedChatModel?: string;
};

const LightRays = dynamic(() => import("ui/light-rays"), {
  ssr: false,
});

const Particles = dynamic(() => import("ui/particles"), {
  ssr: false,
});

const debounce = createDebounce();

const firstTimeStorage = getStorageManager("IS_FIRST");
const isFirstTime = firstTimeStorage.get() ?? true;
firstTimeStorage.set(false);

export default function ChatBot({ threadId, initialMessages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const { uploadFiles } = useThreadFileUploader(threadId);
  const { agents } = useAgents({ limit: 50 });
  const { data: providers } = useChatModels();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const handleFileDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      await uploadFiles(files);
    },
    [uploadFiles],
  );
  const { isDragging } = useFileDragOverlay({
    onDropFiles: handleFileDrop,
  });

  const [
    appStoreMutate,
    model,
    toolChoice,
    allowedAppDefaultToolkit,
    allowedMcpServers,
    threadList,
    threadMentions,
    threadImageToolModel,
    groupChatMode,
  ] = appStore(
    useShallow((state) => [
      state.mutate,
      state.chatModel,
      state.toolChoice,
      state.allowedAppDefaultToolkit,
      state.allowedMcpServers,
      state.threadList,
      state.threadMentions,
      state.threadImageToolModel,
      state.groupChatMode,
    ]),
  );

  const generateTitle = useGenerateThreadTitle({
    threadId,
  });

  const [showParticles, setShowParticles] = useState(isFirstTime);

  // Set newChatHandler in store for mobile header button
  useEffect(() => {
    const handleNewChat = () => {
      router.push("/");
      router.refresh();
    };
    appStoreMutate({ newChatHandler: handleNewChat });

    // Cleanup on unmount
    return () => {
      appStoreMutate({ newChatHandler: undefined });
    };
  }, [router, appStoreMutate]);

  const onFinish = useCallback(() => {
    const messages = latestRef.current.messages;
    const prevThread = latestRef.current.threadList.find(
      (v) => v.id === threadId,
    );
    const isNewThread =
      !prevThread?.title &&
      messages.filter((v) => v.role === "user" || v.role === "assistant")
        .length < 3;
    if (isNewThread) {
      const part = messages
        .slice(0, 2)
        .flatMap((m) =>
          m.parts
            .filter((v) => v.type === "text")
            .map(
              (p) =>
                `${m.role}: ${truncateString((p as TextUIPart).text, 500)}`,
            ),
        );
      if (part.length > 0) {
        generateTitle(part.join("\n\n"));
      }
    } else if (latestRef.current.threadList[0]?.id !== threadId) {
      mutate("/api/thread");
    }
  }, []);

  const [input, setInput] = useState("");

  const {
    messages,
    status,
    setMessages,
    addToolResult: _addToolResult,
    error,
    sendMessage,
    stop,
  } = useChat<MyUIMessage>({
    id: threadId,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // send chat message to server
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ messages, body, id }) => {
        if (window.location.pathname !== `/chat/${threadId}`) {
          console.log("replace-state");
          window.history.replaceState({}, "", `/chat/${threadId}`);
        }
        const lastMessage = messages.at(-1)!;
        // Filter out UI-only parts (e.g., source-url) so the model doesn't receive unknown parts
        const attachments: ChatAttachment[] = lastMessage.parts.reduce(
          (acc: ChatAttachment[], part: any) => {
            if (part?.type === "file") {
              acc.push({
                type: "file",
                url: part.url,
                mediaType: part.mediaType,
                filename: part.filename,
              });
            } else if (part?.type === "source-url") {
              acc.push({
                type: "source-url",
                url: part.url,
                mediaType: part.mediaType,
                filename: part.title,
              });
            }
            return acc;
          },
          [],
        );

        const sanitizedLastMessage = {
          ...lastMessage,
          parts: lastMessage.parts.filter((p: any) => p?.type !== "source-url"),
        } as typeof lastMessage;
        const hasFilePart = lastMessage.parts?.some(
          (p) => (p as any)?.type === "file",
        );

        // Extract agent mentions from current mentions
        const agentMentions = (latestRef.current.mentions || []).filter(
          (m) => m.type === "agent",
        );

        // Determine if we should send chatModel to backend
        // - Multiple agents: don't send chatModel (each agent uses its own model)
        // - Single agent with type='agent': don't send chatModel (model cannot be replaced)
        // - Single agent with other type: send chatModel (model can be replaced)
        // - No agent: send chatModel (pure model chat)
        let finalChatModel = latestRef.current.model;

        if (agentMentions.length === 1) {
          // Single agent: check if model type is 'agent'
          const agent = latestRef.current.agents?.find(
            (a) => a.id === agentMentions[0].agentId,
          );
          if (agent?.model) {
            // Check model type from providers data
            const currentProviders = latestRef.current.providers;
            if (currentProviders) {
              const provider = currentProviders.find(
                (p) => p.provider === agent.model!.provider,
              );
              const modelInfo = provider?.models.find(
                (m) => m.name === agent.model!.model,
              );
              // If model type is 'agent', don't send chatModel
              if (modelInfo?.type === "agent") {
                finalChatModel = undefined;
              }
            }
          }
        } else if (agentMentions.length > 1) {
          // Multiple agents: don't send chatModel, let each agent use its own model
          finalChatModel = undefined;
        }

        // Check if we should open right panel for comparison mode
        const isComparison = groupChatMode === "comparison";
        const hasMultipleAgents = agentMentions.length >= 2;

        if (isComparison && hasMultipleAgents) {
          // Open right panel immediately when user sends message
          // Skip the first agent (shown in main chat) and show agents 2-5 (max 4)
          const agentInfos = agentMentions.slice(1, 5).map((mention) => {
            const agent = latestRef.current.agents?.find(
              (a) => a.id === mention.agentId,
            );

            // Show user's info on right panel immediately
            return {
              agentId: mention.agentId,
              agentName: mention.name,
              agentIcon: agent?.icon,
              messages: [lastMessage],
            };
          });

          const totalAgents = Math.min(agentMentions.length, 5);
          const perAgentWidth = 100 / totalAgents;
          const rightAgentsCount = Math.min(Math.max(totalAgents - 1, 0), 4);
          const rightPanelWidth = rightAgentsCount * perAgentWidth;
          const leftPanelWidth = perAgentWidth;

          appStoreMutate((prev) => {
            const teamTabIndex = prev.rightPanel.tabs.findIndex(
              (tab) => tab.id === "team",
            );

            if (teamTabIndex >= 0) {
              const newTabs = [...prev.rightPanel.tabs];
              newTabs[teamTabIndex] = {
                ...newTabs[teamTabIndex],
                mode: "comparison",
                content: { agents: agentInfos, status },
              };

              return {
                rightPanel: {
                  ...prev.rightPanel,
                  isOpen: true,
                  tabs: newTabs,
                  activeTabId: "team",
                  panelSizes: [leftPanelWidth, rightPanelWidth],
                },
              };
            }

            return {
              rightPanel: {
                ...prev.rightPanel,
                isOpen: true,
                tabs: [
                  ...prev.rightPanel.tabs,
                  {
                    id: "team",
                    mode: "comparison",
                    title: "Team",
                    content: { agents: agentInfos, status },
                  },
                ],
                activeTabId: "team",
                panelSizes: [leftPanelWidth, rightPanelWidth],
              },
            };
          });
        }

        const requestBody: ChatApiSchemaRequestBody = {
          ...body,
          id,
          ...{
            // selected model - use finalChatModel which may be undefined for certain agent scenarios
            chatModel: (body as { model: ChatModel })?.model ?? finalChatModel,
          },

          toolChoice: latestRef.current.toolChoice,
          allowedAppDefaultToolkit:
            latestRef.current.mentions?.length || hasFilePart
              ? []
              : latestRef.current.allowedAppDefaultToolkit,
          allowedMcpServers: latestRef.current.mentions?.length
            ? {}
            : latestRef.current.allowedMcpServers,
          mentions: latestRef.current.mentions, // include agents/tools/workflows in mentions
          message: sanitizedLastMessage,
          imageTool: {
            model: latestRef.current.threadImageToolModel[threadId],
          },
          attachments,
        };
        return { body: requestBody };
      },
    }),
    messages: initialMessages as MyUIMessage[],
    generateId: generateUUID,
    experimental_throttle: 100,
    onFinish,
  });
  const [isDeleteThreadPopupOpen, setIsDeleteThreadPopupOpen] = useState(false);

  const addToolResult = useCallback(
    async (result: Parameters<typeof _addToolResult>[0]) => {
      await _addToolResult(result);
      // sendMessage();
    },
    [_addToolResult],
  );

  const mounted = useMounted();

  const latestRef = useToRef({
    toolChoice,
    model,
    allowedAppDefaultToolkit,
    allowedMcpServers,
    messages,
    threadList,
    threadId,
    mentions: threadMentions[threadId],
    threadImageToolModel,
    agents,
    providers,
  });

  // Build blockId/toolCallId -> agentInfo mapping from agent tags
  const blockAgentMap = useMemo(() => {
    const map = new Map<string, { agentId: string; agentName: string }>();

    messages.forEach((msg) => {
      msg.parts
        .filter(
          (p): p is Extract<typeof p, { type: "data-agent-tag" }> =>
            p.type === "data-agent-tag",
        )
        .forEach((tag) => {
          const { agentId, agentName, blockId, toolCallId } = tag.data;
          if (blockId) {
            map.set(blockId, { agentId, agentName });
          }
          if (toolCallId) {
            map.set(toolCallId, { agentId, agentName });
          }
        });
    });

    return map;
  }, [messages]);

  // Get ordered agent IDs based on user's selection order (from threadMentions)
  const orderedAgentIds = useMemo(() => {
    const agentMentions = threadMentions[threadId] || [];
    const mentionedAgentIds = agentMentions
      .filter((m) => m.type === "agent")
      .map((m) => m.agentId);

    return mentionedAgentIds;
  }, [threadMentions, threadId]);

  // Group messages by agentId for multi-agent display
  const groupedMessagesByAgent = useMemo(() => {
    const groups: Record<string, UIMessage[]> = {};

    // Initialize groups for all selected agents (from user's selection, not from message stream)
    // This is the correct approach: we know which agents are selected before messages arrive
    orderedAgentIds.forEach((agentId) => {
      groups[agentId] = [];
    });

    // Process messages and group parts by agent
    messages.forEach((msg) => {
      if (msg.role === "user") {
        // User messages will be added later to all agent groups
        return;
      }

      if (msg.role === "assistant") {
        // Group assistant message parts by agent based on tags
        const agentParts: Record<string, any[]> = {};
        const agentUsage: Record<string, ChatMetadata["usage"] | undefined> =
          {};
        const agentNames: Record<string, string | undefined> = {};
        let currentAgentId = orderedAgentIds[0] || "default"; // Track current agent for consecutive parts

        msg.parts.forEach((part) => {
          if (part.type === "data-agent-tag") {
            const tagAgentId = (part as any).data?.agentId || "default";
            const tagAgentName = (part as any).data?.agentName;
            currentAgentId = tagAgentId;
            if (tagAgentId) agentNames[tagAgentId] = tagAgentName;
            return;
          }

          if (part.type === "data-agent-finish") {
            const finishAgentId = (part as any).data?.agentId;
            const finishAgentName = (part as any).data?.agentName;
            const usage = (part as any).data?.usage;
            if (finishAgentId) {
              agentUsage[finishAgentId] = usage;
              agentNames[finishAgentId] =
                finishAgentName ?? agentNames[finishAgentId];
            }
            return;
          }

          const blockId = (part as any).id || (part as any).toolCallId;
          if (blockId) {
            const agentInfo = blockAgentMap.get(blockId);
            if (!agentInfo) {
              return;
            }
            const agentId = agentInfo.agentId;
            agentNames[agentId] = agentInfo.agentName ?? agentNames[agentId];

            if (!agentParts[agentId]) {
              agentParts[agentId] = [];
            }
            agentParts[agentId].push(part);
          } else {
            const agentId = currentAgentId;
            if (!agentParts[agentId]) {
              agentParts[agentId] = [];
            }
            agentParts[agentId].push(part);
          }
        });

        // Create separate messages for each agent
        Object.entries(agentParts).forEach(([agentId, parts]) => {
          if (!groups[agentId]) {
            groups[agentId] = [];
          }

          const meta = (msg.metadata as ChatMetadata) || {};
          const agent = agents.find((a) => a.id === agentId);
          const usage = agentUsage[agentId] ?? meta.usage;
          const agentName = agentNames[agentId] ?? agent?.name;

          groups[agentId].push({
            ...msg,
            parts,
            metadata: {
              ...meta,
              usage,
              agentId,
              agentName,
            },
          });
        });
      }
    });

    // Merge by original chronological order: push user messages and agent-specific assistant messages
    Object.keys(groups).forEach((agentId) => {
      const agentMessages = groups[agentId];
      const byId = new Map(agentMessages.map((m) => [m.id, m]));
      const combined: UIMessage[] = [];

      messages.forEach((msg) => {
        if (msg.role === "user") {
          combined.push(msg);
          return;
        }
        if (msg.role === "assistant") {
          const agentMsg = byId.get(msg.id);
          if (agentMsg) combined.push(agentMsg);
        }
      });

      groups[agentId] = combined;
    });

    return groups;
  }, [messages, blockAgentMap, status, orderedAgentIds]); // Use orderedAgentIds instead of extracting from stream

  const selectedGroupChatMode = useMemo(() => {
    return groupChatMode;
  }, [groupChatMode]);

  // For comparison mode with multiple agents: show only first agent in main chat area
  const messagesForMainChat = useMemo(() => {
    const agentIds = Object.keys(groupedMessagesByAgent).filter(
      (id) => id !== "default",
    );
    const hasMultipleAgents = agentIds.length >= 2;
    const isMulticast = selectedGroupChatMode === "comparison";

    if (!isMulticast || !hasMultipleAgents) {
      // Single agent or non-multicast mode: show all messages
      return messages;
    }

    // Use user's selection order to determine first agent
    const firstAgentId =
      orderedAgentIds.find((id) => agentIds.includes(id)) || agentIds[0];
    const mainChatMessages = groupedMessagesByAgent[firstAgentId] || [];

    return mainChatMessages;
  }, [
    messages,
    groupedMessagesByAgent,
    selectedGroupChatMode,
    orderedAgentIds,
  ]);

  const isLoading = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  const emptyMessage = useMemo(
    () => messagesForMainChat.length === 0 && !error,
    [messagesForMainChat.length, error],
  );

  const isInitialThreadEntry = useMemo(
    () =>
      initialMessages.length > 0 &&
      initialMessages.at(-1)?.id === messagesForMainChat.at(-1)?.id,
    [messagesForMainChat],
  );

  const isPendingToolCall = useMemo(() => {
    if (status != "ready") return false;
    const lastMessage = messagesForMainChat.at(-1);
    if (lastMessage?.role != "assistant") return false;
    const lastPart = lastMessage.parts.at(-1);
    if (!lastPart) return false;
    if (!isToolUIPart(lastPart)) return false;
    if (lastPart.state.startsWith("output")) return false;
    return true;
  }, [status, messagesForMainChat]);

  const space = useMemo(() => {
    if (!isLoading || error) return false;
    const lastMessage = messagesForMainChat.at(-1);
    if (lastMessage?.role == "user") return "think";
    const lastPart = lastMessage?.parts.at(-1);
    if (!lastPart) return "think";
    const secondPart = lastMessage?.parts[1];
    if (secondPart?.type == "text" && secondPart.text.length == 0)
      return "think";
    if (lastPart?.type == "step-start") {
      return lastMessage?.parts.length == 1 ? "think" : "space";
    }
    return false;
  }, [isLoading, messagesForMainChat]);

  // Automatically update right panel content for comparison mode
  useEffect(() => {
    const agentIds = Object.keys(groupedMessagesByAgent).filter(
      (id) => id !== "default",
    );
    const hasMultipleAgents = agentIds.length >= 2;
    const isMulticast = selectedGroupChatMode === "comparison";

    if (isMulticast && hasMultipleAgents) {
      // Sort agentIds based on user's selection order
      const sortedAgentIds = orderedAgentIds.filter((id) =>
        agentIds.includes(id),
      );
      // Add any agents not in the original selection (shouldn't happen normally)
      agentIds.forEach((id) => {
        if (!sortedAgentIds.includes(id)) {
          sortedAgentIds.push(id);
        }
      });

      // Update right panel content with agent messages
      // Skip the first agent (shown in main chat area) and show agents 2-5 in right panel (max 4)
      const panelAgentIds = sortedAgentIds.slice(1, 5);
      console.log("[ChatBot] Panel agent IDs (skipping first):", panelAgentIds);

      const agentInfos = panelAgentIds.map((agentId, _index) => {
        const agentMessages = groupedMessagesByAgent[agentId] || [];
        const agent = agents.find((a) => a.id === agentId);

        const agentInfo = {
          agentId,
          agentName: agent?.name || `Agent ${agentId}`,
          agentIcon: agent?.icon,
          messages: agentMessages,
        };

        return agentInfo;
      });

      appStoreMutate((prev) => {
        const teamTabIndex = prev.rightPanel.tabs.findIndex(
          (tab) => tab.id === "team",
        );

        if (teamTabIndex >= 0) {
          const newTabs = [...prev.rightPanel.tabs];
          newTabs[teamTabIndex] = {
            ...newTabs[teamTabIndex],
            mode: "comparison",
            content: { agents: agentInfos, status },
          };

          const totalAgents = Math.min(sortedAgentIds.length, 5);
          const perAgentWidth = 100 / totalAgents;
          const rightAgentsCount = Math.min(Math.max(totalAgents - 1, 0), 4);
          const rightPanelWidth =
            agentInfos.length > 0
              ? rightAgentsCount * perAgentWidth
              : (prev.rightPanel.panelSizes?.[1] ?? perAgentWidth);
          const leftPanelWidth = perAgentWidth;

          return {
            rightPanel: {
              ...prev.rightPanel,
              tabs: newTabs,
              panelSizes: [leftPanelWidth, rightPanelWidth],
              isOpen: prev.rightPanel.isOpen,
            },
          };
        }
        return prev;
      });
    }
    // Don't automatically close panel - let user control it
  }, [
    groupedMessagesByAgent,
    selectedGroupChatMode,
    agents,
    appStoreMutate,
    orderedAgentIds,
  ]);

  const particle = useMemo(() => {
    return (
      <AnimatePresence>
        {showParticles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 5 }}
            className="pointer-events-none fixed inset-0"
          >
            <div className="absolute top-0 left-0 w-full h-full z-10">
              <LightRays />
            </div>
            <div className="absolute top-0 left-0 w-full h-full z-10">
              <Particles particleCount={400} particleBaseSize={10} />
            </div>

            <div className="absolute top-0 left-0 w-full h-full z-10">
              <div className="w-full h-full bg-gradient-to-t from-background to-50% to-transparent z-20" />
            </div>
            <div className="absolute top-0 left-0 w-full h-full z-10">
              <div className="w-full h-full bg-gradient-to-l from-background to-20% to-transparent z-20" />
            </div>
            <div className="absolute top-0 left-0 w-full h-full z-10">
              <div className="w-full h-full bg-gradient-to-r from-background to-20% to-transparent z-20" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }, [showParticles]);

  const handleFocus = useCallback(() => {
    setShowParticles(false);
    debounce(() => setShowParticles(true), 60000);
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isScrollAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    setIsAtBottom(isScrollAtBottom);
    handleFocus();
  }, [handleFocus]);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    appStoreMutate({ currentThreadId: threadId });
    return () => {
      appStoreMutate({ currentThreadId: null });
    };
  }, [threadId]);

  useEffect(() => {
    appStoreMutate((prev) => {
      const pending = prev.pendingThreadMentions || [];
      if (!pending.length) return prev as any;
      const onlyAgents = pending.filter((m: any) => m.type === "agent");
      return {
        pendingThreadMentions: undefined,
        threadMentions: {
          ...prev.threadMentions,
          [threadId]: onlyAgents,
        },
      } as any;
    });
  }, [threadId]);

  useEffect(() => {
    if (isInitialThreadEntry)
      containerRef.current?.scrollTo({
        top: containerRef.current?.scrollHeight,
        behavior: "instant",
      });
  }, [isInitialThreadEntry]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutEvent(e, Shortcuts.openNewChat)) {
        e.preventDefault();
        router.push("/");
        router.refresh();
        return;
      }

      const messages = latestRef.current.messages;
      if (messages.length === 0) return;
      const isLastMessageCopy = isShortcutEvent(e, Shortcuts.lastMessageCopy);
      const isDeleteThread = isShortcutEvent(e, Shortcuts.deleteThread);
      if (!isDeleteThread && !isLastMessageCopy) return;
      e.preventDefault();
      e.stopPropagation();
      if (isLastMessageCopy) {
        const lastMessage = messages.at(-1);
        const lastMessageText = lastMessage!.parts
          .filter((part): part is TextUIPart => part.type == "text")
          ?.at(-1)?.text;
        if (!lastMessageText) return;
        navigator.clipboard.writeText(lastMessageText);
        toast.success("Last message copied to clipboard");
      }
      if (isDeleteThread) {
        setIsDeleteThreadPopupOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  useEffect(() => {
    if (mounted) {
      handleFocus();
    }
  }, [input]);

  return (
    <div className="relative h-full">
      {particle}
      <div
        className={cn(
          emptyMessage && "justify-center pb-24",
          "flex flex-col min-w-0 relative h-full z-40",
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 z-40 bg-background/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="rounded-2xl px-6 py-5 bg-background/80 shadow-xl border border-border flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <FilePlus className="size-6" />
              </div>
              <span className="text-sm text-muted-foreground">
                Drop files to upload
              </span>
            </div>
          </div>
        )}
        {emptyMessage ? (
          <ChatGreeting />
        ) : (
          <>
            <div
              className={"flex flex-col gap-2 overflow-y-auto py-6 z-10"}
              ref={containerRef}
              onScroll={handleScroll}
            >
              {messagesForMainChat.map((message, index) => {
                const isLastMessage = messagesForMainChat.length - 1 === index;
                return (
                  <PreviewMessage
                    threadId={threadId}
                    messageIndex={index}
                    prevMessage={messagesForMainChat[index - 1]}
                    key={message.id}
                    message={message as UIMessage}
                    status={status}
                    addToolResult={addToolResult}
                    isLoading={isLoading || isPendingToolCall}
                    isLastMessage={isLastMessage}
                    setMessages={setMessages as any}
                    sendMessage={sendMessage as any}
                    className={""}
                    currentUser={session?.user}
                  />
                );
              })}
              {space && (
                <div
                  className={cn("w-full mx-auto relative", "max-w-6xl px-6")}
                >
                  <div className={space == "space" ? "opacity-0" : ""}>
                    <Think />
                  </div>
                </div>
              )}

              {error && <ErrorMessage error={error} />}
              <div className="min-h-[calc(70dvh-40px)]" />
            </div>
          </>
        )}

        <div
          className={clsx(
            messagesForMainChat.length && "absolute bottom-14",
            "w-full z-10",
          )}
        >
          <div
            className={cn(
              "mx-auto relative flex justify-center items-center -top-2",
              "max-w-6xl px-6",
            )}
          >
            <ScrollToBottomButton
              show={!isAtBottom && messagesForMainChat.length > 0}
              onClick={scrollToBottom}
            />
          </div>

          <PromptInput
            input={input}
            threadId={threadId}
            sendMessage={sendMessage as any}
            setInput={setInput}
            isLoading={isLoading || isPendingToolCall}
            onStop={stop}
            onFocus={isFirstTime ? undefined : handleFocus}
            onNewChat={() => {
              setMessages([]);
              setInput("");

              appStoreMutate((prev) => {
                const currentMentions = prev.threadMentions[threadId] || [];
                const agentMentions = currentMentions.filter(
                  (m: any) => m.type === "agent",
                );
                const clearedTabs = prev.rightPanel.tabs.map((tab) => {
                  if (tab.id === "team") {
                    return {
                      ...tab,
                      content: { agents: [], status: undefined },
                    };
                  }
                  if (tab.id === "code") {
                    return { ...tab, content: { code: "" } };
                  }
                  if (tab.id === "web") {
                    return { ...tab, content: { url: "" } };
                  }
                  if (tab.id === "chart") {
                    return { ...tab, content: { data: [] } };
                  }
                  return tab;
                });
                return {
                  pendingThreadMentions: agentMentions,
                  rightPanel: {
                    ...prev.rightPanel,
                    tabs: clearedTabs,
                    activeTabId: prev.rightPanel.activeTabId,
                    isOpen: prev.rightPanel.isOpen,
                  },
                };
              });

              router.push("/");
            }}
          />
        </div>
        <DeleteThreadPopup
          threadId={threadId}
          onClose={() => setIsDeleteThreadPopupOpen(false)}
          open={isDeleteThreadPopupOpen}
        />
      </div>
    </div>
  );
}

function DeleteThreadPopup({
  threadId,
  onClose,
  open,
}: { threadId: string; onClose: () => void; open: boolean }) {
  const t = useTranslations();
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const handleDelete = useCallback(() => {
    setIsDeleting(true);
    safe(() => deleteThreadAction(threadId))
      .watch(() => setIsDeleting(false))
      .ifOk(() => {
        toast.success(t("Chat.Thread.threadDeleted"));
        router.push("/");
      })
      .ifFail(() => toast.error(t("Chat.Thread.failedToDeleteThread")))
      .watch(() => onClose());
  }, [threadId, router]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Chat.Thread.deleteChat")}</DialogTitle>
          <DialogDescription>
            {t("Chat.Thread.areYouSureYouWantToDeleteThisChatThread")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("Common.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} autoFocus>
            {t("Common.delete")}
            {isDeleting && <Loader className="size-3.5 ml-2 animate-spin" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ScrollToBottomButtonProps {
  show: boolean;
  onClick: () => void;
  className?: string;
}

function ScrollToBottomButton({
  show,
  onClick,
  className,
}: ScrollToBottomButtonProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className={className}
        >
          <Button
            onClick={onClick}
            className="shadow-lg backdrop-blur-sm border transition-colors"
            size="icon"
            variant="ghost"
          >
            <ArrowDown />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
