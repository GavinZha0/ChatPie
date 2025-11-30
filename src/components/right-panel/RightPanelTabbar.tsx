"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { RIGHT_PANEL_TAB_CONFIGS } from "./tab-config";

export function RightPanelTabbar({ isChatRoute }: { isChatRoute: boolean }) {
  const [rightPanel, appStoreMutate] = appStore(
    useShallow((state) => [state.rightPanel, state.mutate]),
  );

  const handleTabIconClick = (
    tabConfig: (typeof RIGHT_PANEL_TAB_CONFIGS)[number],
  ) => {
    appStoreMutate((prev) => {
      const existingTab = prev.rightPanel.tabs.find(
        (tab) => tab.id === tabConfig.id,
      );
      const nextTabs = existingTab
        ? prev.rightPanel.tabs.map((t) =>
            t.id === tabConfig.id ? { ...t, hidden: false } : t,
          )
        : [
            ...prev.rightPanel.tabs,
            {
              id: tabConfig.id,
              mode: tabConfig.defaultMode,
              title: tabConfig.title,
              content: tabConfig.getInitialContent(),
              hidden: false,
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

  if (!isChatRoute) return null;

  const resolvedActiveTabId =
    rightPanel.activeTabId ?? rightPanel.tabs[0]?.id ?? null;

  return (
    <div className="hidden h-full w-12 flex-shrink-0 flex-col justify-center border-l border-border/60 bg-muted/40 overflow-hidden md:flex">
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
            className={`relative ${index !== RIGHT_PANEL_TAB_CONFIGS.length - 1 ? "border-b border-border/40" : ""}`}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleTabIconClick(tabConfig)}
                  className={`flex size-12 items-center justify-center rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
                  aria-pressed={Boolean(isActive)}
                  aria-label={tabConfig.title}
                  data-has-tab={Boolean(existingTab)}
                >
                  <div
                    className={`flex items-center justify-center rounded-md ${
                      isActive
                        ? "size-9 bg-primary text-primary-foreground ring-1 ring-primary"
                        : "size-9"
                    }`}
                  >
                    <IconComponent className="size-5" />
                  </div>
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
  );
}
