"use client";

import { ToolUIPart } from "ai";
import { useCallback, useEffect, memo, useRef } from "react";
import { toast } from "sonner";
import { Loader, MousePointer } from "lucide-react";
import { Separator } from "ui/separator";
import { TextShimmer } from "ui/text-shimmer";
import { PageAgentConfig, PageAgentResult } from "../types/page-agent";

interface PageAgentToolInvocationProps {
  part: ToolUIPart;
  onResult: (result: any) => void;
}

export const PageAgentToolInvocation = memo(
  ({ part, onResult }: PageAgentToolInvocationProps) => {
    const hasExecutedRef = useRef(false);

    const command = (part.input as { command?: string })?.command ?? "";

    // executeCommand is declared before useEffect so the dependency is explicit
    // and hoisting is not relied upon. useCallback memoises the function so
    // that useEffect only re-fires when a real dependency actually changes.
    const executeCommand = useCallback(async () => {
      try {
        if (!command) throw new Error("No command provided");

        const config: PageAgentConfig = (part as any)?.output?.config;
        if (!config) throw new Error("No configuration provided");
        if (!config.model || !config.baseURL)
          throw new Error("Invalid configuration");

        const { PageAgent } = await import("page-agent");

        const agent = new PageAgent({
          model: config.model,
          baseURL: config.baseURL,
          apiKey: config.apiKey,
          language: config.language || "en-US",
        });

        // Disable the library's built-in dialog panel
        agent.panel.show = () => {};

        const commandResult: PageAgentResult = await agent.execute(command);

        if (commandResult?.success === false) {
          const errorMessage =
            typeof commandResult.data === "string"
              ? commandResult.data
              : "Page Agent execution failed";
          onResult({ success: false, error: errorMessage });
        } else {
          onResult({
            success: true,
            message: "Page Agent executed successfully",
            data: commandResult,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        toast.error(`Page Agent failed: ${errorMessage}`);
        onResult({ success: false, error: errorMessage });
      }
    }, [command, part, onResult]);

    // Auto-execute once on mount. hasExecutedRef prevents double-fire in
    // React 18 strict-mode and on re-renders triggered by the parent —
    // even if executeCommand's identity changes due to a dep update.
    useEffect(() => {
      if (hasExecutedRef.current) return;
      hasExecutedRef.current = true;
      executeCommand();
    }, [executeCommand]);

    // This component is mounted only while the browser action is in-flight
    // (parent renders it when output has "config", and unmounts it once
    // onResult triggers an output update that removes "config").
    // Always show an executing indicator — no separate isExecuting state needed.
    return (
      <div className="flex flex-col fade-in duration-300 animate-in">
        <div className="flex gap-2 items-center cursor-pointer group/title">
          <div className="p-1.5 text-primary bg-input/40 rounded">
            <MousePointer className="size-3.5 text-green-500" />
          </div>
          <span className="font-bold flex items-center gap-2">
            <TextShimmer>Page Agent</TextShimmer>
          </span>
          <Loader className="size-3.5 animate-spin text-muted-foreground" />
        </div>
        <div className="flex gap-2 py-2">
          <div className="w-7 flex justify-center">
            <Separator
              orientation="vertical"
              className="h-full bg-gradient-to-t from-transparent to-border to-5%"
            />
          </div>
          <div className="w-full">
            <div className="min-w-0 w-full py-2 px-4 rounded-lg bg-card border text-xs text-muted-foreground">
              {command}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

PageAgentToolInvocation.displayName = "PageAgentToolInvocation";
