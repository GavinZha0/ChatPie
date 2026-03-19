"use client";

import { ToolUIPart } from "ai";
import { useState, useEffect, memo, useRef } from "react";
import { toast } from "sonner";
import { PageAgentConfig, PageAgentResult } from "../types/page-agent";

interface PageAgentToolInvocationProps {
  part: ToolUIPart;
  onResult: (result: any) => void;
}

export const PageAgentToolInvocation = memo(
  ({ part, onResult }: PageAgentToolInvocationProps) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const hasExecutedRef = useRef(false);

    const { input } = part;
    const inputAny = input as any;

    // Auto-execute when component mounts
    useEffect(() => {
      if (hasExecutedRef.current) return;
      hasExecutedRef.current = true;
      executeCommand();
    }, []);

    const executeCommand = async () => {
      if (isExecuting) return; // Prevent multiple executions

      setIsExecuting(true);

      try {
        const command = inputAny?.command;
        if (!command) throw new Error("No command provided");

        // Get configuration from tool output (returned from backend execute function)
        const config: PageAgentConfig = (part as any)?.output?.config;
        if (!config) {
          throw new Error("No configuration provided");
        }

        // Validate required configuration fields
        if (!config.model || !config.baseURL) {
          throw new Error("Invalid configuration");
        }

        // Direct import and execution - this will automatically open a dialog
        const { PageAgent } = await import("page-agent");

        const agent = new PageAgent({
          model: config.model,
          baseURL: config.baseURL,
          apiKey: config.apiKey,
          language: config.language || "en-US",
        });

        // Disable the default dialog to prevent automatic dialog opening
        agent.panel.show = () => {};

        // Execute command
        const commandResult: PageAgentResult = await agent.execute(command);

        // Check if command was successful
        if (commandResult?.success === false) {
          // Show error from command result
          const errorMessage =
            typeof commandResult.data === "string"
              ? commandResult.data
              : "Page Agent execution failed";

          onResult({
            success: false,
            error: errorMessage,
          });
        } else {
          // Command executed successfully
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

        onResult({
          success: false,
          error: errorMessage,
        });
      } finally {
        setIsExecuting(false);
      }
    };

    // Default minimal state (should not show normally)
    return null;
  },
);

PageAgentToolInvocation.displayName = "PageAgentToolInvocation";
