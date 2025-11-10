"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import useSWR from "swr";
import { useMutateAgents } from "@/hooks/queries/use-agents";
import { useMcpList } from "@/hooks/queries/use-mcp-list";
import { useWorkflowToolList } from "@/hooks/queries/use-workflow-tool-list";
import { useObjectState } from "@/hooks/use-object-state";
import { useBookmark } from "@/hooks/queries/use-bookmark";
import {
  Agent,
  AgentCreateSchema,
  AgentUpdateSchema,
  AgentSummary,
} from "app-types/agent";
import { BACKGROUND_COLORS, EMOJI_DATA } from "lib/const";
import { cn, fetcher } from "lib/utils";
import { safe } from "ts-safe";
import { handleErrorWithToast } from "ui/shared-toast";
import { Loader } from "lucide-react";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Textarea } from "ui/textarea";
import { ScrollArea } from "ui/scroll-area";
import { Skeleton } from "ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "ui/dialog";
import { ShareableActions, Visibility } from "@/components/shareable-actions";
import { SelectModel } from "@/components/select-model";
import { AgentIconPicker } from "./agent-icon-picker";
import { AgentToolSelector } from "./agent-tool-selector";
import { notify } from "lib/notify";
import { appStore } from "@/app/store";

const defaultConfig = (): PartialBy<
  Omit<Agent, "createdAt" | "updatedAt" | "userId">,
  "id"
> => {
  // Get the global default chat model
  const currentChatModel = appStore.getState().chatModel;

  return {
    name: "",
    description: "",
    icon: {
      type: "emoji",
      value: EMOJI_DATA[0],
      style: {
        backgroundColor: BACKGROUND_COLORS[0],
      },
    },
    instructions: {
      role: "",
      systemPrompt: "",
      mentions: [],
      chatModel: currentChatModel,
    },
    visibility: "private",
  };
};

export function AgentEditor({
  initialAgent: initialAgentProp,
  userId,
  onClose,
}: {
  initialAgent?: Agent;
  userId: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const mutateAgents = useMutateAgents();

  const isCreating = !initialAgentProp?.id;

  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Agent state management
  const [agent, setAgent] = useObjectState<PartialBy<Agent, "id">>(
    initialAgentProp || (defaultConfig() as PartialBy<Agent, "id">),
  );

  // Ownership and access
  const isOwner = useMemo(() => {
    if (isCreating) return true;
    return initialAgentProp?.userId === userId;
  }, [isCreating, initialAgentProp, userId]);

  const hasEditAccess = useMemo(() => {
    if (isCreating) return true;
    return isOwner || initialAgentProp?.visibility === "public";
  }, [isCreating, isOwner, initialAgentProp]);

  // Bookmark controls
  // Note: Bookmark loading state is handled in header controls; do not block form interactions.

  // Tool loading state
  const { isLoading: isMcpLoading } = useMcpList();
  const { isLoading: isWorkflowLoading } = useWorkflowToolList();
  const isLoadingTool = useMemo(
    () => isMcpLoading || isWorkflowLoading,
    [isMcpLoading, isWorkflowLoading],
  );

  const saveAgent = useCallback(() => {
    if (agent.id) {
      // Update existing agent
      safe(() => setIsSaving(true))
        .map(() => AgentUpdateSchema.parse({ ...agent }))
        .map(JSON.stringify)
        .map(async (body) =>
          fetcher(`/api/agent/${agent.id}`, {
            method: "PUT",
            body,
          }),
        )
        .ifOk((updatedAgent) => {
          mutateAgents(updatedAgent);
          toast.success(t("Agent.updated"));
          onClose();
        })
        .ifFail(handleErrorWithToast)
        .watch(() => setIsSaving(false));
    } else {
      // Create new agent
      safe(() => setIsSaving(true))
        .map(() => AgentCreateSchema.parse({ ...(agent as Agent), userId }))
        .map(JSON.stringify)
        .map(async (body) =>
          fetcher(`/api/agent`, {
            method: "POST",
            body,
          }),
        )
        .ifOk((updatedAgent) => {
          mutateAgents(updatedAgent);
          toast.success(t("Agent.created"));
          onClose();
        })
        .ifFail(handleErrorWithToast)
        .watch(() => setIsSaving(false));
    }
  }, [agent, userId, mutateAgents, t, onClose]);

  const deleteAgent = useCallback(async () => {
    if (!agent?.id) return;
    const ok = await notify.confirm({
      description: t("Agent.deleteConfirm"),
    });
    if (!ok) return;
    const agentId = agent.id as string;
    safe(() => setIsSaving(true))
      .map(() =>
        fetcher(`/api/agent/${agentId}`, {
          method: "DELETE",
        }),
      )
      .ifOk(() => {
        mutateAgents({ id: agentId }, true);
        toast.success(t("Agent.deleted"));
        onClose();
      })
      .ifFail(handleErrorWithToast)
      .watch(() => setIsSaving(false));
  }, [agent?.id, mutateAgents, t, onClose]);

  const isLoading = useMemo(() => {
    return isLoadingTool || isSaving;
  }, [isLoadingTool, isSaving]);

  return (
    <ScrollArea className="h-full w-full relative">
      <div className="w-full h-4 absolute bottom-0 left-0 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />
      <div className="relative flex flex-col gap-4 pb-4 h-full">
        {/* Name and Icon */}
        <div className="flex gap-4 items-end">
          <div className="flex flex-col gap-2 flex-1">
            <Label htmlFor="agent-name">
              {t("Agent.agentNameAndIconLabel")}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                value={agent.name || ""}
                onChange={(e) => setAgent({ name: e.target.value })}
                autoFocus
                disabled={isLoading || !hasEditAccess}
                className="hover:bg-input bg-secondary/40 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
                id="agent-name"
                data-testid="agent-name-input"
                placeholder={t("Agent.agentNamePlaceholder")}
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
            {t("Agent.agentDescriptionLabel")}
          </Label>
          <Input
            id="agent-description"
            data-testid="agent-description-input"
            disabled={isLoading || !hasEditAccess}
            placeholder={t("Agent.agentDescriptionPlaceholder")}
            className="hover:bg-input placeholder:text-xs bg-secondary/40 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
            value={agent.description || ""}
            onChange={(e) => setAgent({ description: e.target.value })}
            readOnly={!hasEditAccess}
          />
        </div>

        {/* Role, Instructions, Tools, and Model */}
        <div className="flex flex-col gap-6">
          {/* Role */}
          <div className="flex gap-2 items-center">
            <span>{t("Agent.thisAgentIs")}</span>
            <Input
              id="agent-role"
              data-testid="agent-role-input"
              disabled={isLoading || !hasEditAccess}
              placeholder={t("Agent.agentRolePlaceholder")}
              className="hover:bg-input placeholder:text-xs bg-secondary/40 w-44 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
              value={agent.instructions?.role || ""}
              onChange={(e) =>
                setAgent((prev) => ({
                  instructions: {
                    ...prev.instructions,
                    role: e.target.value || "",
                  },
                }))
              }
              readOnly={!hasEditAccess}
            />
            <span>{t("Agent.expertIn")}</span>
          </div>

          {/* Instructions */}
          <div className="flex gap-2 flex-col">
            <Label htmlFor="agent-prompt" className="text-base">
              {t("Agent.agentInstructionsLabel")}
            </Label>
            <Textarea
              id="agent-prompt"
              data-testid="agent-prompt-textarea"
              ref={textareaRef}
              disabled={isLoading || !hasEditAccess}
              placeholder={t("Agent.agentInstructionsPlaceholder")}
              className="p-6 hover:bg-input min-h-48 max-h-96 overflow-y-auto resize-none placeholder:text-xs bg-secondary/40 transition-colors border-transparent !border-none !focus-visible:bg-input !ring-0"
              value={agent.instructions?.systemPrompt || ""}
              onChange={(e) =>
                setAgent((prev) => ({
                  instructions: {
                    ...prev.instructions,
                    systemPrompt: e.target.value || "",
                  },
                }))
              }
              readOnly={!hasEditAccess}
            />
          </div>

          {/* Tools */}
          <div className="flex gap-2 flex-col">
            <Label htmlFor="agent-tool-bindings" className="text-base">
              {t("Agent.agentToolsLabel")}
            </Label>
            <AgentToolSelector
              mentions={agent.instructions?.mentions || []}
              isLoading={isLoadingTool}
              disabled={isLoading}
              hasEditAccess={hasEditAccess}
              onChange={(mentions) =>
                setAgent((prev) => ({
                  instructions: {
                    ...prev.instructions,
                    mentions,
                  },
                }))
              }
            />

            {/* Model */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-model-select" className="text-base">
                {t("Agent.agentModelLabel")}
              </Label>
              <div
                className={cn(
                  "w-full",
                  (isLoading || !hasEditAccess) &&
                    "pointer-events-none opacity-60",
                )}
              >
                <SelectModel
                  currentModel={agent.instructions?.chatModel}
                  buttonClassName="w-full justify-between"
                  onSelect={(model) => {
                    if (isLoading || !hasEditAccess) {
                      return;
                    }

                    setAgent((prev) => ({
                      instructions: {
                        ...prev.instructions,
                        chatModel: model,
                      },
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {hasEditAccess && (
          <div className={cn("flex justify-end gap-2")}>
            {/* Delete button - only for owners */}
            {agent.id && isOwner && (
              <Button
                className="mt-2 hover:text-destructive"
                variant="ghost"
                onClick={deleteAgent}
                disabled={isLoading}
              >
                {t("Common.delete")}
              </Button>
            )}

            {/* Save button */}
            <Button
              className={cn("mt-2", !agent.id || !isOwner ? "ml-auto" : "")}
              onClick={saveAgent}
              disabled={isLoading || !hasEditAccess}
              data-testid="agent-save-button"
            >
              {isSaving ? t("Common.saving") : t("Common.save")}
              {isSaving && <Loader className="size-4 animate-spin" />}
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

interface EditAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string | null | undefined;
  initialData?: AgentSummary;
  userId: string;
  userRole?: string | null;
}

export function EditAgentDialog({
  open,
  onOpenChange,
  agentId,
  initialData,
  userId,
}: EditAgentDialogProps) {
  const t = useTranslations();

  const isCreating = !agentId;

  // Fetch full agent data when editing
  const {
    data: fullAgent,
    isLoading: isLoadingAgent,
    mutate: mutateFullAgent,
  } = useSWR<Agent>(agentId ? `/api/agent/${agentId}` : null, fetcher, {
    revalidateOnFocus: false,
    fallbackData: initialData as Agent | undefined,
  });

  // Determine if we have complete agent data
  const hasCompleteData = useMemo(() => {
    if (isCreating) return true;
    return fullAgent?.instructions !== undefined;
  }, [isCreating, fullAgent]);

  // Ownership and actions state for header controls
  const isOwner = useMemo(() => {
    if (isCreating) return true;
    return fullAgent?.userId === userId;
  }, [isCreating, fullAgent?.userId, userId]);

  const mutateAgents = useMutateAgents();
  const { toggleBookmark, isLoading: isBookmarkToggleLoadingFn } = useBookmark({
    itemType: "agent",
  });
  const isBookmarkToggleLoading = useMemo(() => {
    return (fullAgent?.id && isBookmarkToggleLoadingFn(fullAgent.id)) || false;
  }, [fullAgent?.id, isBookmarkToggleLoadingFn]);
  const [isVisibilityChangeLoading, setIsVisibilityChangeLoading] =
    useState(false);

  const updateVisibility = useCallback(
    async (visibility: Visibility) => {
      if (!fullAgent?.id) return;
      safe(() => setIsVisibilityChangeLoading(true))
        .map(() => AgentUpdateSchema.parse({ visibility }))
        .map(JSON.stringify)
        .map(async (body) =>
          fetcher(`/api/agent/${fullAgent.id}`, {
            method: "PUT",
            body,
          }),
        )
        .ifOk(() => {
          mutateFullAgent(
            { ...(fullAgent as Agent), visibility },
            { revalidate: false },
          );
          mutateAgents({ id: fullAgent.id, visibility });
          toast.success(t("Agent.visibilityUpdated"));
        })
        .ifFail(handleErrorWithToast)
        .watch(() => setIsVisibilityChangeLoading(false));
    },
    [fullAgent, mutateFullAgent, mutateAgents, t],
  );

  const handleBookmarkToggle = useCallback(async () => {
    if (!fullAgent?.id || isBookmarkToggleLoading) return;
    safe(async () => {
      await toggleBookmark({
        id: fullAgent.id!,
        isBookmarked: fullAgent.isBookmarked!,
      });
    })
      .ifOk(() => {
        mutateFullAgent(
          { ...(fullAgent as Agent), isBookmarked: !fullAgent.isBookmarked },
          { revalidate: false },
        );
      })
      .ifFail(handleErrorWithToast);
  }, [fullAgent, toggleBookmark, isBookmarkToggleLoading, mutateFullAgent]);

  const headerDisabled =
    isLoadingAgent || isVisibilityChangeLoading || isBookmarkToggleLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>
              {isCreating ? t("Agent.newAgent") : t("Agent.editAgent")}
            </DialogTitle>
            {fullAgent?.id && (
              <div className="mr-4 sm:mr-4">
                <ShareableActions
                  type="agent"
                  visibility={fullAgent.visibility || "private"}
                  isBookmarked={fullAgent?.isBookmarked || false}
                  isOwner={isOwner}
                  onVisibilityChange={updateVisibility}
                  isVisibilityChangeLoading={isVisibilityChangeLoading}
                  disabled={headerDisabled}
                  onBookmarkToggle={handleBookmarkToggle}
                  isBookmarkToggleLoading={isBookmarkToggleLoading}
                />
              </div>
            )}
          </div>
        </DialogHeader>
        {/* Show loading skeleton when editing and data is incomplete */}
        {!hasCompleteData && isLoadingAgent ? (
          <div className="p-6 space-y-4 min-h-[600px]">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <AgentEditor
            initialAgent={fullAgent || undefined}
            userId={userId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
