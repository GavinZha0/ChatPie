"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ResizableHandle, ResizablePanel } from "ui/resizable";
import { TemporaryChatTab } from "./tabs/TemporaryChatTab";
import { HistoryChatTab } from "./tabs/HistoryChatTab";
import { TeamComparisonTab } from "./tabs/TeamComparisonTab";
import { VoiceChatTab } from "./tabs/VoiceChatTab";

export function RightTabPanel({ isChatRoute }: { isChatRoute: boolean }) {
  const [rightPanel, appStoreMutate] = appStore(
    useShallow((state) => [state.rightPanel, state.mutate]),
  );

  const resolvedActiveTabId =
    rightPanel.activeTabId ?? rightPanel.tabs[0]?.id ?? null;

  const closeTab = (tabId: string) => {
    appStoreMutate((prev) => {
      const nextTabs = prev.rightPanel.tabs.map((t) =>
        t.id === tabId ? { ...t, hidden: true } : t,
      );
      const hasVisibleTabs = nextTabs.some((t) => !t.hidden);
      const nextActiveTabId = (() => {
        if (prev.rightPanel.activeTabId !== tabId)
          return prev.rightPanel.activeTabId;
        const nextVisible = nextTabs.find((t) => !t.hidden);
        return nextVisible?.id;
      })();
      const updates: Partial<typeof prev> = {
        rightPanel: {
          ...prev.rightPanel,
          tabs: nextTabs,
          activeTabId: nextActiveTabId,
          isOpen: hasVisibleTabs ? prev.rightPanel.isOpen : false,
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

  if (!isChatRoute) return null;

  return (
    <>
      <ResizableHandle
        withHandle
        className={`hidden ${rightPanel.isOpen ? "md:flex" : ""}`}
      />
      <ResizablePanel
        defaultSize={rightPanel.isOpen ? rightPanel.panelSizes[1] : 0}
        minSize={rightPanel.isOpen ? 20 : 0}
        className="hidden md:block overflow-hidden relative z-30"
      >
        <div className="h-full flex flex-col bg-muted/30">
          {rightPanel.tabs.map((tab) => {
            const isActive = tab.id === resolvedActiveTabId;
            const isHidden = Boolean(tab.hidden);
            if (tab.id === "team") {
              if (tab.mode === "comparison") {
                return (
                  <div
                    key={tab.id}
                    className={`flex-1 overflow-y-auto p-4 ${isHidden ? "hidden" : isActive ? "" : "hidden"}`}
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
                  className={`flex flex-1 items-center justify-center text-sm text-muted-foreground ${isHidden ? "hidden" : isActive ? "" : "hidden"}`}
                >
                  No team content yet
                </div>
              );
            }
            if (tab.id === "tempchat") {
              return (
                <div
                  key={tab.id}
                  className={`${isHidden ? "hidden" : isActive ? "" : "hidden"} h-full`}
                >
                  <TemporaryChatTab />
                </div>
              );
            }
            if (tab.id === "voice") {
              return (
                <div
                  key={tab.id}
                  className={`${isHidden ? "hidden" : isActive ? "" : "hidden"} h-full`}
                >
                  <VoiceChatTab />
                </div>
              );
            }
            if (tab.id === "history") {
              return (
                <div
                  key={tab.id}
                  className={`${isHidden ? "hidden" : isActive ? "" : "hidden"} h-full`}
                >
                  <HistoryChatTab onClose={() => closeTab("history")} />
                </div>
              );
            }
            return (
              <div
                key={tab.id}
                className={`flex h-full flex-col ${isHidden ? "hidden" : isActive ? "" : "hidden"}`}
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
