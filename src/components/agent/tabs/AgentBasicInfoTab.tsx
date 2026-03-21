"use client";

import { Input } from "ui/input";
import { Label } from "ui/label";
import { ScrollArea } from "ui/scroll-area";
import { AgentIconPicker } from "../agent-icon-picker";
import { useTranslations } from "next-intl";

interface AgentBasicInfoTabProps {
  agent: any;
  setAgent: (updates: Partial<any>) => void;
  isLoading: boolean;
  hasEditAccess: boolean;
  isSelectedModelAgentType: boolean;
}

export function AgentBasicInfoTab({
  agent,
  setAgent,
  isLoading,
  hasEditAccess,
  isSelectedModelAgentType,
}: AgentBasicInfoTabProps) {
  const t = useTranslations("Agent");
  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-1">
        {/* Name and Icon */}
        <div className="flex gap-4 items-end">
          <div className="flex flex-col gap-2 flex-1">
            <Label htmlFor="agent-name">{t("agentNameAndIconLabel")}</Label>
            <div className="flex items-center gap-3">
              <Input
                value={agent.name || ""}
                onChange={(e) => setAgent({ name: e.target.value })}
                autoFocus
                disabled={isLoading || !hasEditAccess}
                className="hover:bg-input bg-secondary/40 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
                id="agent-name"
                data-testid="agent-name-input"
                placeholder={t("agentNameAndIconLabel")}
                readOnly={!hasEditAccess}
              />
            </div>
          </div>
          <AgentIconPicker
            icon={agent.icon}
            disabled={!hasEditAccess}
            onChange={(icon) => setAgent({ icon })}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="agent-description">
            {t("agentDescriptionLabel")}
          </Label>
          <Input
            id="agent-description"
            data-testid="agent-description-input"
            disabled={isLoading || !hasEditAccess}
            placeholder={t("agentDescriptionLabel")}
            className="hover:bg-input placeholder:text-xs bg-secondary/40 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
            value={agent.description || ""}
            onChange={(e) => setAgent({ description: e.target.value })}
            readOnly={!hasEditAccess}
          />
        </div>

        {/* Role */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="agent-role">{t("agentRole")}</Label>
          <Input
            id="agent-role"
            data-testid="agent-role-input"
            disabled={isLoading || !hasEditAccess || isSelectedModelAgentType}
            placeholder={
              isSelectedModelAgentType
                ? "Built-in agent configuration"
                : t("agentRolePlaceholder")
            }
            className="hover:bg-input placeholder:text-xs bg-secondary/40 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
            value={agent.role || ""}
            onChange={(e) => setAgent({ role: e.target.value || "" })}
            readOnly={!hasEditAccess || isSelectedModelAgentType}
          />
        </div>
      </div>
    </ScrollArea>
  );
}
