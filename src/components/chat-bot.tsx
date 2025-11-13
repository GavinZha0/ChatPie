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
  ChatMetadata,
  ChatModel,
  MyUIMessage,
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
    chatWidthMode,
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
      state.chatWidthMode,
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

        // Check if we should open right panel for broadcast mode
        const isBroadcast = groupChatMode === "one-to-many";
        const hasMultipleAgents = agentMentions.length >= 2;

        if (isBroadcast && hasMultipleAgents) {
          console.log(
            "[ChatBot] Broadcast mode detected with",
            agentMentions.length,
            "agents",
          );

          // Open right panel immediately when user sends message
          // Skip the first agent (shown in main chat) and show agents 2-5 (max 4)
          const agentInfos = agentMentions.slice(1, 5).map((mention) => {
            const agent = latestRef.current.agents?.find(
              (a) => a.id === mention.agentId,
            );

            return {
              agentId: mention.agentId,
              agentName: mention.name,
              agentIcon: agent?.icon,
              messages: [lastMessage], // Show the user's message immediately
            };
          });

          // Calculate panel width: each agent needs 20% width
          const agentCount = agentInfos.length;
          const rightPanelWidth = Math.min(agentCount * 20, 80); // Max 80%
          const leftPanelWidth = 100 - rightPanelWidth;

          console.log(
            "[ChatBot] Opening/updating band panel for agents:",
            agentInfos.map((a) => a.agentName),
          );

          appStoreMutate((prev) => {
            const bandTabIndex = prev.rightPanel.tabs.findIndex(
              (t) => t.type === "band",
            );

            if (bandTabIndex >= 0) {
              // Band tab exists - update it and force panel open
              console.log(
                "[ChatBot] Band tab exists, updating and opening panel",
              );
              const newTabs = [...prev.rightPanel.tabs];
              newTabs[bandTabIndex] = {
                ...newTabs[bandTabIndex],
                content: { agents: agentInfos },
              };

              return {
                rightPanel: {
                  ...prev.rightPanel,
                  isOpen: true, // Force open even if was closed
                  tabs: newTabs,
                  activeTabId: "band-tab",
                  panelSizes: [leftPanelWidth, rightPanelWidth],
                },
              };
            } else {
              // No band tab - create new one
              console.log("[ChatBot] Creating new band tab and opening panel");
              return {
                rightPanel: {
                  ...prev.rightPanel,
                  isOpen: true,
                  tabs: [
                    ...prev.rightPanel.tabs,
                    {
                      id: "band-tab",
                      type: "band",
                      title: "Group Chat",
                      content: { agents: agentInfos },
                    },
                  ],
                  activeTabId: "band-tab",
                  panelSizes: [leftPanelWidth, rightPanelWidth],
                },
              };
            }
          });
        }

        const requestBody: ChatApiSchemaRequestBody = {
          ...body,
          id,

          // Use new chatModels array if agents are selected
          ...(agentMentions.length > 0
            ? {
                chatModels: agentMentions.map((mention) => {
                  // Find the agent to get its preferred model
                  const agent = latestRef.current.agents?.find(
                    (a) => a.id === mention.agentId,
                  );
                  const agentModel = agent?.chatModel;

                  return {
                    provider:
                      agentModel?.provider ||
                      latestRef.current.model?.provider ||
                      "openai",
                    model:
                      agentModel?.model ||
                      latestRef.current.model?.model ||
                      "gpt-4",
                    agentId: mention.agentId,
                    agentName: mention.name,
                  };
                }),
              }
            : {
                // Single model mode (no agents selected)
                chatModel:
                  (body as { model: ChatModel })?.model ??
                  latestRef.current.model,
              }),

          toolChoice: latestRef.current.toolChoice,
          allowedAppDefaultToolkit:
            latestRef.current.mentions?.length || hasFilePart
              ? []
              : latestRef.current.allowedAppDefaultToolkit,
          allowedMcpServers: latestRef.current.mentions?.length
            ? {}
            : latestRef.current.allowedMcpServers,
          mentions: latestRef.current.mentions,
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

    console.log("[ChatBot] User selected agent order:", mentionedAgentIds);
    return mentionedAgentIds;
  }, [threadMentions, threadId]);

  // Group messages by agentId for multi-agent display
  const groupedMessagesByAgent = useMemo(() => {
    const groups: Record<string, UIMessage[]> = {};

    // Debug: log blockAgentMap size and actual mappings
    console.log(
      "[ChatBot] blockAgentMap size:",
      blockAgentMap.size,
      "entries:",
      Array.from(blockAgentMap.entries()),
    );
    if (blockAgentMap.size > 0) {
      console.log("[ChatBot] blockAgentMap details:");
      blockAgentMap.forEach((value, key) => {
        console.log(
          `  blockId/toolCallId: ${key} -> agentId: ${value.agentId}, agentName: ${value.agentName}`,
        );
      });
    }

    // Initialize groups for all selected agents (from user's selection, not from message stream)
    // This is the correct approach: we know which agents are selected before messages arrive
    orderedAgentIds.forEach((agentId) => {
      groups[agentId] = [];
    });

    console.log(
      "[ChatBot] Initialized groups for selected agents:",
      Object.keys(groups),
    );

    // Process messages and group parts by agent
    messages.forEach((msg) => {
      if (msg.role === "user") {
        // User messages will be added later to all agent groups
        return;
      }

      if (msg.role === "assistant") {
        // Group assistant message parts by agent based on tags
        const agentParts: Record<string, any[]> = {};
        let currentAgentId = "default"; // Track current agent for consecutive parts

        console.log(
          `[ChatBot] Processing assistant message ${msg.id}, total parts: ${msg.parts.length}`,
        );
        console.log(
          "[ChatBot] All parts:",
          msg.parts.map((p) => ({
            type: p.type,
            id: (p as any).id,
            toolCallId: (p as any).toolCallId,
          })),
        );

        msg.parts.forEach((part) => {
          // Skip tag parts themselves but update context
          if (part.type === "data-agent-tag") {
            // Extract agentId from tag to set current context
            const tagAgentId = (part as any).data?.agentId || "default";
            console.log(
              `[ChatBot]   Found agent tag: agentId=${tagAgentId}, blockId=${(part as any).data?.blockId}, toolCallId=${(part as any).data?.toolCallId}`,
            );
            currentAgentId = tagAgentId;
            return;
          }

          if (part.type === "data-agent-finish") {
            return;
          }

          // Find which agent this part belongs to
          const blockId = (part as any).id || (part as any).toolCallId;
          const agentInfo = blockId ? blockAgentMap.get(blockId) : null;
          const agentId = agentInfo?.agentId || currentAgentId; // Use current agent if no explicit tag

          console.log(
            `[ChatBot]   Part type=${part.type}, blockId=${blockId}, mapped to agentId=${agentId} (from ${agentInfo ? "blockAgentMap" : "currentAgentId"})`,
          );

          if (!agentParts[agentId]) {
            agentParts[agentId] = [];
          }
          agentParts[agentId].push(part);
        });

        // Debug: log agent parts distribution
        console.log(
          "[ChatBot] Message",
          msg.id,
          "distributed to agents:",
          Object.keys(agentParts),
        );

        // Create separate messages for each agent
        Object.entries(agentParts).forEach(([agentId, parts]) => {
          if (!groups[agentId]) {
            groups[agentId] = [];
          }

          groups[agentId].push({
            ...msg,
            parts,
          });
        });
      }
    });

    // Add user messages to all agent groups (including those with no content yet)
    const userMessages = messages.filter((m) => m.role === "user");
    Object.keys(groups).forEach((agentId) => {
      // Interleave user messages with agent messages
      const agentMessages = groups[agentId];
      const combined: UIMessage[] = [];

      userMessages.forEach((userMsg, index) => {
        combined.push(userMsg);
        if (agentMessages[index]) {
          combined.push(agentMessages[index]);
        }
      });

      groups[agentId] = combined;
    });

    // Debug: log final groups
    console.log(
      "[ChatBot] Final grouped agents:",
      Object.keys(groups),
      "counts:",
      Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    );

    return groups;
  }, [messages, blockAgentMap, status, orderedAgentIds]); // Use orderedAgentIds instead of extracting from stream

  const selectedGroupChatMode = useMemo(() => {
    return groupChatMode;
  }, [groupChatMode]);

  // For broadcast mode with multiple agents: show only first agent in main chat area
  const messagesForMainChat = useMemo(() => {
    const agentIds = Object.keys(groupedMessagesByAgent).filter(
      (id) => id !== "default",
    );
    const hasMultipleAgents = agentIds.length >= 2;
    const isBroadcast = selectedGroupChatMode === "one-to-many";

    console.log(
      "[ChatBot] messagesForMainChat - available agentIds:",
      agentIds,
    );

    if (!isBroadcast || !hasMultipleAgents) {
      // Single agent or non-broadcast mode: show all messages
      return messages;
    }

    // Use user's selection order to determine first agent
    const firstAgentId =
      orderedAgentIds.find((id) => agentIds.includes(id)) || agentIds[0];
    const mainChatMessages = groupedMessagesByAgent[firstAgentId] || [];

    console.log(
      "[ChatBot] Main chat using agent:",
      firstAgentId,
      "message count:",
      mainChatMessages.length,
    );

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

  // Automatically update right panel content for broadcast mode
  useEffect(() => {
    const agentIds = Object.keys(groupedMessagesByAgent).filter(
      (id) => id !== "default",
    );
    const hasMultipleAgents = agentIds.length >= 2;
    const isBroadcast = selectedGroupChatMode === "one-to-many";

    console.log(
      "[ChatBot] Panel update check - available agentIds:",
      agentIds,
      "hasMultiple:",
      hasMultipleAgents,
      "isBroadcast:",
      isBroadcast,
    );

    if (isBroadcast && hasMultipleAgents) {
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

      console.log(
        "[ChatBot] Panel update - sorted agent order:",
        sortedAgentIds,
      );

      // Update right panel content with agent messages
      // Skip the first agent (shown in main chat area) and show agents 2-5 in right panel (max 4)
      const panelAgentIds = sortedAgentIds.slice(1, 5);
      console.log("[ChatBot] Panel agent IDs (skipping first):", panelAgentIds);

      const agentInfos = panelAgentIds.map((agentId, index) => {
        const agentMessages = groupedMessagesByAgent[agentId] || [];
        const firstAgentMsg = agentMessages.find((m) => m.role === "assistant");
        const metadata = firstAgentMsg?.metadata as ChatMetadata | undefined;
        const agent = agents.find((a) => a.id === agentId);

        const agentInfo = {
          agentId,
          agentName: metadata?.agentName || agent?.name || `Agent ${agentId}`,
          agentIcon: agent?.icon,
          messages: agentMessages,
        };

        console.log(`[ChatBot] Panel agent ${index + 1}:`, {
          agentId,
          agentName: agentInfo.agentName,
          messageCount: agentMessages.length,
          hasMetadata: !!metadata,
          foundInAgentList: !!agent,
        });

        return agentInfo;
      });

      console.log(
        "[ChatBot] Updating panel with agents:",
        agentInfos.map((a) => ({
          id: a.agentId,
          name: a.agentName,
          msgCount: a.messages.length,
        })),
      );

      appStoreMutate((prev) => {
        const bandTabIndex = prev.rightPanel.tabs.findIndex(
          (t) => t.type === "band",
        );

        // Update band tab content if it exists
        if (bandTabIndex >= 0) {
          const newTabs = [...prev.rightPanel.tabs];
          newTabs[bandTabIndex] = {
            ...newTabs[bandTabIndex],
            content: { agents: agentInfos },
          };

          // Recalculate panel width based on current agent count
          const agentCount = agentInfos.length;
          const rightPanelWidth = Math.min(agentCount * 20, 80); // Max 80%
          const leftPanelWidth = 100 - rightPanelWidth;

          return {
            rightPanel: {
              ...prev.rightPanel,
              tabs: newTabs,
              panelSizes: [leftPanelWidth, rightPanelWidth], // Update width dynamically
              // Keep panel open if it was already open
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
    <>
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
          <ChatGreeting widthMode={chatWidthMode} />
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
                    widthMode={chatWidthMode}
                    className={
                      isLastMessage &&
                      message.role != "user" &&
                      !space &&
                      message.parts.length > 1
                        ? "min-h-[calc(55dvh-40px)]"
                        : ""
                    }
                  />
                );
              })}
              {space && (
                <>
                  <div
                    className={cn(
                      "w-full mx-auto relative",
                      chatWidthMode === "wide"
                        ? "max-w-none px-10"
                        : "max-w-4xl px-6",
                    )}
                  >
                    <div className={space == "space" ? "opacity-0" : ""}>
                      <Think />
                    </div>
                  </div>
                  <div className="min-h-[calc(55dvh-56px)]" />
                </>
              )}

              {error && (
                <ErrorMessage error={error} widthMode={chatWidthMode} />
              )}
              <div className="min-w-0 min-h-52" />
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
              chatWidthMode === "wide" ? "max-w-none px-10" : "max-w-4xl px-6",
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
            widthMode={chatWidthMode}
            onNewChat={() => {
              // Generate new thread ID
              const newThreadId = generateUUID();

              // Clear chat messages and reset state
              setMessages([]);
              setInput("");

              // Clear thread-specific states but preserve agent mentions and model
              appStoreMutate((prev) => {
                const currentMentions = prev.threadMentions[threadId] || [];
                return {
                  threadFiles: {
                    ...prev.threadFiles,
                    [newThreadId]: [], // Clear files for new thread
                  },
                  threadImageToolModel: {
                    ...prev.threadImageToolModel,
                    [newThreadId]: undefined, // Clear image tool for new thread
                  },
                  threadMentions: {
                    ...prev.threadMentions,
                    [newThreadId]: currentMentions, // Preserve current mentions
                  },
                };
              });

              // Update URL without page refresh
              router.replace(`/chat/${newThreadId}`);
            }}
          />
        </div>
        <DeleteThreadPopup
          threadId={threadId}
          onClose={() => setIsDeleteThreadPopupOpen(false)}
          open={isDeleteThreadPopupOpen}
        />
      </div>
    </>
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
