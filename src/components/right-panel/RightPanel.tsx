"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ResizableHandle, ResizablePanel } from "ui/resizable";
import { TemporaryChatTab } from "./tabs/TemporaryChatTab";
import { HistoryTabContent } from "@/components/history/chat-bot-history";
import { TeamComparisonTab } from "./tabs/TeamComparisonTab";
import { VoiceTab } from "./tabs/VoiceTab";

export function RightPanel({ isChatRoute }: { isChatRoute: boolean }) {
  const [rightPanel, appStoreMutate] = appStore(
    useShallow((state) => [state.rightPanel, state.mutate]),
  );

  const resolvedActiveTabId =
    rightPanel.activeTabId ?? rightPanel.tabs[0]?.id ?? null;

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
      if (tabId === "voice") {
        (updates as any).voiceChat = {
          ...prev.voiceChat,
          isOpen: false,
        };
      }
      return updates;
    });
  };

  if (!(isChatRoute && rightPanel.isOpen && resolvedActiveTabId)) return null;

  return (
    <>
      <ResizableHandle withHandle className="hidden md:flex" />
      <ResizablePanel
        defaultSize={rightPanel.panelSizes[1]}
        minSize={20}
        className="hidden md:block overflow-hidden relative z-30"
      >
        <div className="h-full flex flex-col bg-muted/30">
          {rightPanel.tabs.map((tab) => {
            const isActive = tab.id === resolvedActiveTabId;
            if (tab.id === "team") {
              if (tab.mode === "comparison") {
                return (
                  <div
                    key={tab.id}
                    className={`flex-1 overflow-y-auto p-4 ${isActive ? "" : "hidden"}`}
                  >
                    <TeamComparisonTab
                      agents={tab.content.agents || []}
                      status={tab.content.status}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={tab.id}
                  className={`flex flex-1 items-center justify-center text-sm text-muted-foreground ${isActive ? "" : "hidden"}`}
                >
                  No team content yet
                </div>
              );
            }
            if (tab.id === "tempchat") {
              return (
                <div
                  key={tab.id}
                  className={`${isActive ? "" : "hidden"} h-full`}
                >
                  <TemporaryChatTab />
                </div>
              );
            }
            if (tab.id === "voice") {
              return (
                <div
                  key={tab.id}
                  className={`${isActive ? "" : "hidden"} h-full`}
                >
                  <VoiceTab />
                </div>
              );
            }
            if (tab.id === "history") {
              return (
                <div
                  key={tab.id}
                  className={`${isActive ? "" : "hidden"} h-full`}
                >
                  <HistoryTabContent onClose={() => closeTab("history")} />
                </div>
              );
            }
            return (
              <div
                key={tab.id}
                className={`flex h-full flex-col ${isActive ? "" : "hidden"}`}
              >
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">
                    {tab.title}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden p-4">
                  {tab.id === "web" && tab.content?.url ? (
                    <iframe
                      src={tab.content.url}
                      className="h-full w-full rounded-lg border"
                      title={tab.title}
                    />
                  ) : tab.id === "web" ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No web content yet
                    </div>
                  ) : null}
                  {tab.id === "chart" && (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No chart content yet
                    </div>
                  )}
                  {tab.id === "code" && (
                    <div className="h-full overflow-auto rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                      {tab.content?.code || "No code content yet"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ResizablePanel>
    </>
  );
}
