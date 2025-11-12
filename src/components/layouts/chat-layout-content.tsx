"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import { X } from "lucide-react";
import { Button } from "ui/button";

export function ChatLayoutContent({ children }: { children: React.ReactNode }) {
  const [rightPanel, appStoreMutate] = appStore(
    useShallow((state) => [state.rightPanel, state.mutate]),
  );

  const handlePanelResize = (sizes: number[]) => {
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

      return {
        rightPanel: {
          ...prev.rightPanel,
          tabs: newTabs,
          activeTabId: newActiveTabId,
          isOpen: newTabs.length > 0,
        },
      };
    });
  };

  const setActiveTab = (tabId: string) => {
    appStoreMutate((prev) => ({
      rightPanel: {
        ...prev.rightPanel,
        activeTabId: tabId,
      },
    }));
  };

  return (
    <div className="flex-1 overflow-hidden">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full"
        onLayout={handlePanelResize}
      >
        {/* main chat area */}
        <ResizablePanel
          defaultSize={rightPanel.isOpen ? rightPanel.panelSizes[0] : 100}
          minSize={20}
          className="overflow-y-auto"
        >
          {children}
        </ResizablePanel>

        {/* right-side panel - only show on desktop when opened */}
        {rightPanel.isOpen && (
          <>
            <ResizableHandle withHandle className="hidden md:flex" />
            <ResizablePanel
              defaultSize={rightPanel.panelSizes[1]}
              minSize={20}
              className="hidden md:block overflow-hidden"
            >
              <div className="h-full flex flex-col bg-muted/30">
                {rightPanel.tabs.length > 0 ? (
                  <Tabs
                    value={rightPanel.activeTabId}
                    onValueChange={setActiveTab}
                    className="h-full flex flex-col"
                  >
                    <div className="border-b bg-background/50 backdrop-blur-sm">
                      <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0">
                        {rightPanel.tabs.map((tab) => (
                          <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-3"
                          >
                            <span className="mr-2">{tab.title}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-4 p-0 hover:bg-muted rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.id);
                              }}
                            >
                              <X className="size-3" />
                            </Button>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {rightPanel.tabs.map((tab) => (
                        <TabsContent
                          key={tab.id}
                          value={tab.id}
                          className="h-full m-0 p-4"
                        >
                          {/* Render different content according to tab.type */}
                          {tab.type === "http" && (
                            <div className="h-full">
                              <iframe
                                src={tab.content.url}
                                className="w-full h-full border rounded-lg"
                                title={tab.title}
                              />
                            </div>
                          )}
                          {tab.type === "chart" && (
                            <div className="h-full">
                              {/* Chart content */}
                              <div className="text-muted-foreground">
                                Chart: {tab.title}
                              </div>
                            </div>
                          )}
                          {tab.type === "code" && (
                            <div className="h-full">
                              {/* Code content */}
                              <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
                                {tab.content.code}
                              </pre>
                            </div>
                          )}
                          {tab.type === "band" && (
                            <div className="h-full">
                              {/* group chat content */}
                              <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
                                {tab.content.band}
                              </pre>
                            </div>
                          )}
                        </TabsContent>
                      ))}
                    </div>
                  </Tabs>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No content
                  </div>
                )}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
