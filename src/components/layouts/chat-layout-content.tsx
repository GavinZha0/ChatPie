"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ResizablePanelGroup, ResizablePanel } from "ui/resizable";
import { useEffect, useRef } from "react";
import type { ImperativePanelGroupHandle } from "react-resizable-panels";
import { RightTabPanel, RightPanelTabbar } from "@/components/right-panel";
import { usePathname } from "next/navigation";

export function ChatLayoutContent({ children }: { children: React.ReactNode }) {
  const [rightPanel, appStoreMutate] = appStore(
    useShallow((state) => [state.rightPanel, state.mutate]),
  );
  const pathname = usePathname();
  const isChatRoute =
    pathname === "/" || (pathname?.startsWith("/chat") ?? false);

  const groupRef = useRef<ImperativePanelGroupHandle | null>(null);

  const handlePanelResize = (sizes: number[]) => {
    if (sizes.length < 2) return;
    appStoreMutate((prev) => {
      if (!prev.rightPanel.isOpen) return prev;
      return {
        rightPanel: {
          ...prev.rightPanel,
          panelSizes: [sizes[0], sizes[1]],
        },
      };
    });
  };

  useEffect(() => {
    const api = groupRef.current;
    if (!api || !isChatRoute) return;
    const nextLayout = rightPanel.isOpen
      ? [rightPanel.panelSizes[0], rightPanel.panelSizes[1]]
      : [100, 0];
    api.setLayout(nextLayout);
  }, [rightPanel.isOpen, isChatRoute]);

  if (!isChatRoute) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          ref={groupRef}
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
          <RightTabPanel isChatRoute={isChatRoute} />
        </ResizablePanelGroup>
      </div>
      <RightPanelTabbar isChatRoute={isChatRoute} />
    </div>
  );
}
