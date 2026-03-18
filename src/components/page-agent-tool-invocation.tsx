"use client";

import { ToolUIPart } from "ai";
import { useState, useEffect, memo } from "react";
import { toast } from "sonner";
import { PageAgentConfig, PageAgentResult } from "../types/page-agent";

interface PageAgentToolInvocationProps {
  part: ToolUIPart;
  onResult: (result: any) => void;
}

export const PageAgentToolInvocation = memo(
  ({ part, onResult }: PageAgentToolInvocationProps) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);

    const { input } = part;
    const inputAny = input as any;

    // Auto-execute when component mounts
    useEffect(() => {
      executeCommand();
    }, []);

    const executeCommand = async () => {
      if (isExecuting) return; // Prevent multiple executions

      setIsExecuting(true);
      setError(null);
      setCompleted(false);

      try {
        const command = inputAny?.command;
        if (!command) throw new Error("No command provided");

        // Get configuration from tool output (returned from backend execute function)
        const config: PageAgentConfig = (part as any)?.output?.config;
        if (!config) {
          throw new Error("No configuration provided from backend");
        }

        // Validate required configuration fields
        if (!config.model || !config.baseURL) {
          throw new Error(
            `Invalid configuration: model=${config.model}, baseURL=${config.baseURL}`,
          );
        }

        // Direct import and execution - this will automatically open a dialog
        const { PageAgent } = await import("page-agent");

        const agent = new PageAgent({
          model: config.model,
          baseURL: config.baseURL,
          apiKey: config.apiKey,
          language: config.language || "en-US",
        });

        // Execute command - Page Agent dialog will open automatically
        const commandResult: PageAgentResult = await agent.execute(command);
        console.log("Page Agent result:", commandResult);

        // Check if command was successful
        if (commandResult?.success === false) {
          // Show error from command result
          const errorMessage =
            commandResult.data || "Page Agent execution failed";
          setError(errorMessage);
          toast.error(`Page Agent failed: ${errorMessage}`);

          onResult({
            success: false,
            error: errorMessage,
          });
        } else {
          // Command executed successfully
          setCompleted(true);
          onResult({
            success: true,
            message: "Page Agent dialog opened for page operations",
            data: commandResult,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        toast.error(`Page Agent failed: ${errorMessage}`);

        onResult({
          success: false,
          error: errorMessage,
        });
      } finally {
        setIsExecuting(false);
      }
    };

    // Only show error state
    if (error) {
      return (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <span className="text-sm font-medium">Page Agent failed</span>
          </div>
          <div className="mt-2 text-sm text-red-700">{error}</div>
        </div>
      );
    }

    // Show completion state
    if (completed) {
      return (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
              <svg
                className="w-2 h-2 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L9 9l1.406 1.406a2 2 0 01-2.828 0L9 9a2 2 0 01-2.828 0L5 13z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium">Page Agent is running</span>
          </div>
        </div>
      );
    }

    // Default minimal state (should not show normally)
    return null;
  },
);

PageAgentToolInvocation.displayName = "PageAgentToolInvocation";
