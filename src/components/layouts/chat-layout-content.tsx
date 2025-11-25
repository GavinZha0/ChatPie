"use client";

import { appStore, type TeamTabMode } from "@/app/store";
import { useShallow } from "zustand/shallow";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { Button } from "ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import {
  X,
  Globe,
  BarChart2,
  Code,
  Users,
  MessageCircleDashed,
  ClockIcon,
} from "lucide-react";
import { PreviewMessage } from "@/components/message";
import { getEmojiUrl } from "lib/emoji";
import { UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";
import { Think } from "ui/think";
import { TemporaryChatTabContent } from "@/components/chat-bot-temporary";
import { HistoryTabContent } from "@/components/history/chat-bot-history";
import { usePathname } from "next/navigation";

type RightPanelTabConfig = {
  id: "tempchat" | "history" | "team" | "web" | "code" | "chart";
  title: string;
  icon: typeof Users;
  defaultMode?: TeamTabMode;
  getInitialContent: () => any;
};

const RIGHT_PANEL_TAB_CONFIGS: RightPanelTabConfig[] = [
  {
    id: "tempchat",
    title: "Temporary",
    icon: MessageCircleDashed,
    getInitialContent: () => ({}),
  },
  {
    id: "history",
    title: "Recent chats",
    icon: ClockIcon,
    getInitialContent: () => ({}),
  },
  {
    id: "team",
    title: "Team",
    icon: Users,
    defaultMode: "comparison",
    getInitialContent: () => ({ agents: [], status: undefined }),
  },
  {
    id: "web",
    title: "Web",
    icon: Globe,
    getInitialContent: () => ({ url: "" }),
  },
  {
    id: "code",
    title: "Code",
    icon: Code,
    getInitialContent: () => ({ code: "" }),
  },
  {
    id: "chart",
    title: "Chart",
    icon: BarChart2,
    getInitialContent: () => ({ data: [] }),
  },
];

// Band tab content component for multi-agent chat display
function MulticastTabContent({
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
  // Limit to 4 agents maximum
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
                    widthMode="wide"
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

export function ChatLayoutContent({ children }: { children: React.ReactNode }) {
  const [rightPanel, appStoreMutate] = appStore(
    useShallow((state) => [state.rightPanel, state.mutate]),
  );
  const pathname = usePathname();
  const isChatRoute =
    pathname === "/" || (pathname?.startsWith("/chat") ?? false);

  const handlePanelResize = (sizes: number[]) => {
    if (sizes.length < 2) return;
    appStoreMutate((prev) => ({
      rightPanel: {
        ...prev.rightPanel,
        panelSizes: [sizes[0], sizes[1]],
      },
    }));
  };

  const closeTab = (tabId: string) => {
    appStoreMutate((prev) => {
      const newTabs = prev.rightPanel.tabs.filter((t) => t.id !== tabId);
      const newActiveTabId =
        prev.rightPanel.activeTabId === tabId
          ? newTabs[0]?.id
          : prev.rightPanel.activeTabId;

      const updates: Partial<typeof prev> = {
        rightPanel: {
          ...prev.rightPanel,
          tabs: newTabs,
          activeTabId: newActiveTabId,
          isOpen: newTabs.length > 0 && prev.rightPanel.isOpen,
        },
      };

      if (tabId === "tempchat") {
        (updates as any).temporaryChat = {
          ...prev.temporaryChat,
          isOpen: false,
        };
      }

      return updates;
    });
  };

  const handleTabIconClick = (tabConfig: RightPanelTabConfig) => {
    appStoreMutate((prev) => {
      const existingTab = prev.rightPanel.tabs.find(
        (tab) => tab.id === tabConfig.id,
      );
      const nextTabs = existingTab
        ? prev.rightPanel.tabs
        : [
            ...prev.rightPanel.tabs,
            {
              id: tabConfig.id,
              mode: tabConfig.defaultMode,
              title: tabConfig.title,
              content: tabConfig.getInitialContent(),
            },
          ];

      const isSameTab = prev.rightPanel.activeTabId === tabConfig.id;
      const isCurrentlyActive = prev.rightPanel.isOpen && isSameTab;
      const nextIsOpen = isCurrentlyActive ? false : true;

      const updates: Partial<typeof prev> = {
        rightPanel: {
          ...prev.rightPanel,
          tabs: nextTabs,
          activeTabId: tabConfig.id,
          isOpen: nextIsOpen,
        },
      };

      if (tabConfig.id === "tempchat") {
        (updates as any).temporaryChat = {
          ...prev.temporaryChat,
          isOpen: nextIsOpen,
        };
      }

      return updates;
    });
  };

  const resolvedActiveTabId =
    rightPanel.activeTabId ?? rightPanel.tabs[0]?.id ?? null;
  const activeTab = rightPanel.tabs.find(
    (tab) => tab.id === resolvedActiveTabId,
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full"
          onLayout={handlePanelResize}
        >
          <ResizablePanel
            defaultSize={rightPanel.isOpen ? rightPanel.panelSizes[0] : 100}
            minSize={20}
            className="overflow-y-auto"
          >
            {children}
          </ResizablePanel>

          {isChatRoute && rightPanel.isOpen && activeTab && (
            <>
              <ResizableHandle withHandle className="hidden md:flex" />
              <ResizablePanel
                defaultSize={rightPanel.panelSizes[1]}
                minSize={20}
                className="hidden md:block overflow-hidden relative z-30"
              >
                <div className="h-full flex flex-col bg-muted/30">
                  {activeTab.id === "team" &&
                  activeTab.mode === "comparison" ? (
                    <div className="flex-1 overflow-y-auto p-4">
                      <MulticastTabContent
                        agents={activeTab.content.agents || []}
                        status={activeTab.content.status}
                      />
                    </div>
                  ) : activeTab.id === "team" ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                      No team content yet
                    </div>
                  ) : activeTab.id === "tempchat" ? (
                    <TemporaryChatTabContent />
                  ) : activeTab.id === "history" ? (
                    <HistoryTabContent onClose={() => closeTab("history")} />
                  ) : (
                    <div className="flex h-full flex-col">
                      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">
                          {activeTab.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => closeTab(activeTab.id)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                      <div className="flex-1 overflow-hidden p-4">
                        {activeTab.id === "web" && activeTab.content?.url ? (
                          <iframe
                            src={activeTab.content.url}
                            className="h-full w-full rounded-lg border"
                            title={activeTab.title}
                          />
                        ) : activeTab.id === "web" ? (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No web content yet
                          </div>
                        ) : null}
                        {activeTab.id === "chart" && (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No chart content yet
                          </div>
                        )}
                        {activeTab.id === "code" && (
                          <div className="h-full overflow-auto rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                            {activeTab.content?.code || "No code content yet"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {isChatRoute && (
        <div className="hidden h-full w-12 flex-shrink-0 flex-col border-l border-border/60 bg-muted/40 overflow-hidden md:flex">
          {RIGHT_PANEL_TAB_CONFIGS.map((tabConfig, index) => {
            const IconComponent = tabConfig.icon;
            const existingTab = rightPanel.tabs.find(
              (tab) => tab.id === tabConfig.id,
            );
            const isActive =
              rightPanel.isOpen &&
              resolvedActiveTabId === tabConfig.id &&
              existingTab;

            return (
              <div
                key={tabConfig.id}
                className={`relative ${
                  index !== RIGHT_PANEL_TAB_CONFIGS.length - 1
                    ? "border-b border-border/40"
                    : ""
                }`}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleTabIconClick(tabConfig)}
                      className={`flex size-12 items-center justify-center transition-colors ${
                        isActive
                          ? "bg-background text-foreground"
                          : existingTab
                            ? "text-foreground/80 hover:bg-muted"
                            : "text-muted-foreground hover:bg-muted"
                      }`}
                      aria-pressed={Boolean(isActive)}
                      aria-label={tabConfig.title}
                      data-has-tab={Boolean(existingTab)}
                    >
                      <IconComponent className="size-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" align="center">
                    {tabConfig.title}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
