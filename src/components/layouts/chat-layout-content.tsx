"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ResizablePanelGroup, ResizablePanel } from "ui/resizable";
import { RightPanel, RightPanelTabbar } from "@/components/right-panel";
import { usePathname } from "next/navigation";

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
          <RightPanel isChatRoute={isChatRoute} />
        </ResizablePanelGroup>
      </div>
      <RightPanelTabbar isChatRoute={isChatRoute} />
    </div>
  );
}
