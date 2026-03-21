"use client";

import { useRef } from "react";
import { Textarea } from "ui/textarea";
import { useTranslations } from "next-intl";

interface AgentPromptTabProps {
  agent: any;
  setAgent: (updates: Partial<any>) => void;
  isLoading: boolean;
  hasEditAccess: boolean;
  isSelectedModelAgentType: boolean;
}

export function AgentPromptTab({
  agent,
  setAgent,
  isLoading,
  hasEditAccess,
  isSelectedModelAgentType,
}: AgentPromptTabProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslations("Agent");

  return (
    <Textarea
      id="agent-prompt"
      data-testid="agent-prompt-textarea"
      ref={textareaRef}
      disabled={isLoading || !hasEditAccess || isSelectedModelAgentType}
      placeholder={
        isSelectedModelAgentType
          ? "Built-in agent model configuration"
          : t("agentInstructionsLabel")
      }
      className="p-2 hover:bg-input min-h-130 max-h-[80vh] overflow-y-auto resize-none placeholder:text-xs bg-secondary/40 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
      value={agent.systemPrompt || ""}
      onChange={(e) => setAgent({ systemPrompt: e.target.value || "" })}
      readOnly={!hasEditAccess || isSelectedModelAgentType}
    />
  );
}
